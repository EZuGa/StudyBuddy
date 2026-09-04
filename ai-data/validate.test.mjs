import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, validateDocuments } from './validate.mjs';

const exampleTests = readJson(new URL('./examples/tests.example.json', import.meta.url));
const exampleTerms = readJson(new URL('./examples/terminology.example.json', import.meta.url));
const validatorPath = fileURLToPath(new URL('./validate.mjs', import.meta.url));
const testsDocument = (data) => ({ kind: 'tests', label: 'tests.json', data });
const termsDocument = (data) => ({ kind: 'terminology', label: 'terminology.json', data });
const checkQuestion = (update) => {
  const data = structuredClone(exampleTests);
  update(data[0].questions, data[0]);
  return validateDocuments([testsDocument(data)]);
};
const hasError = (result, pattern) => assert.ok(result.errors.some((error) => pattern.test(error)), result.errors.join('\n'));

test('all example formats validate and validation does not mutate data', () => {
  const snapshot = JSON.stringify([exampleTests, exampleTerms]);
  assert.deepEqual(validateDocuments([testsDocument(exampleTests), termsDocument(exampleTerms)]), { errors: [], warnings: [] });
  assert.equal(JSON.stringify([exampleTests, exampleTerms]), snapshot);
});

test('current project collections satisfy the generation contract', () => {
  const result = validateDocuments([
    testsDocument(readJson(new URL('../public/tests/tests.json', import.meta.url))),
    termsDocument(readJson(new URL('../public/tests/terminology.json', import.meta.url))),
  ]);
  assert.deepEqual(result.errors, []);
});

test('only arrays are accepted, including empty project arrays', () => {
  hasError(validateDocuments([testsDocument(exampleTests[0])]), /must be array/);
  assert.deepEqual(validateDocuments([testsDocument([]), termsDocument([])]).errors, []);
});

test('unknown fields, quiz kinds, and question types are rejected', () => {
  hasError(checkQuestion((questions, quiz) => { quiz.score = 100; }), /additional properties/);
  hasError(checkQuestion((questions, quiz) => { quiz.kind = 'final'; }), /allowed values/);
  hasError(checkQuestion((questions) => { questions[0].type = 'true-false'; }), /constant/);
});

test('single-choice indexes must be integers in range', () => {
  for (const value of [-1, 0.5, 'B', 3]) {
    assert.ok(checkQuestion((questions) => { questions[0].correctAnswer = value; }).errors.length);
  }
  assert.deepEqual(checkQuestion((questions) => { questions[0].correctAnswer = 0; }).errors, []);
});

test('multi-select keys reject missing, duplicate, and out-of-range answers', () => {
  for (const value of [[], [0, 0], [0, 3], [-1], ['A']]) {
    assert.ok(checkQuestion((questions) => { questions[1].correctAnswers = value; }).errors.length);
  }
});

test('duplicate IDs across files are rejected', () => {
  const terms = structuredClone(exampleTerms);
  terms[0].id = exampleTests[0].id;
  terms[0].questions[0].id = exampleTests[0].questions[0].id;
  const result = validateDocuments([testsDocument(exampleTests), termsDocument(terms)]);
  assert.equal(result.errors.filter((error) => error.includes('duplicate id')).length, 2);
});

test('duplicate display options are caught while case-sensitive units remain distinct', () => {
  hasError(checkQuestion((questions) => { questions[0].options = ['LAN', ' LAN ', 'WAN']; }), /duplicate text/);
  assert.deepEqual(checkQuestion((questions) => { questions[0].options = ['1 Bps', '1 bps', '8 bps']; }).errors, []);
});

test('matching must preserve distinct terms and definitions', () => {
  hasError(checkQuestion((questions) => { questions[3].pairs[1].term = 'LAN'; }), /terms must be distinct/);
  hasError(checkQuestion((questions) => { questions[3].pairs[1].definition = questions[3].pairs[0].definition; }), /definitions must be distinct/);
});

test('accepted fill answers must stay non-empty and distinct after app normalization', () => {
  hasError(checkQuestion((questions) => { questions[4].acceptedAnswers = ['byte', 'BYTE.']; }), /equivalent answer/);
  hasError(checkQuestion((questions) => { questions[4].acceptedAnswers = ['...']; }), /empty normalized answer/);
});

test('terminology uses only canonical shared written entries', () => {
  const terms = structuredClone(exampleTerms);
  terms[0].questions[0].prompt = 'Define LAN.';
  hasError(validateDocuments([termsDocument(terms)]), /additional properties/);
  delete terms[0].questions[0].prompt;
  terms[0].questions[0].type = 'multiple-choice';
  hasError(validateDocuments([termsDocument(terms)]), /constant/);
});

test('blank terms and aliases, duplicates, and duplicate concepts are caught', () => {
  for (const change of [
    (questions) => { questions[0].term = ' '; },
    (questions) => { questions[0].acceptedTerms = ['']; },
    (questions) => { questions[0].acceptedTerms = ['Local-area network', 'local area network']; },
    (questions) => { questions[1].term = 'lan'; },
  ]) {
    const terms = structuredClone(exampleTerms);
    change(terms[0].questions);
    assert.ok(validateDocuments([termsDocument(terms)]).errors.length);
  }
});

test('definition answer leaks are review warnings, not asserted factual failures', () => {
  const terms = structuredClone(exampleTerms);
  terms[0].questions[0].definition = 'LAN means local area network.';
  const result = validateDocuments([termsDocument(terms)]);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes('may reveal')));
});

test('multi-blank prompts receive a review warning', () => {
  const result = checkQuestion((questions) => { questions[4].prompt = 'A _____ contains eight _____.'; });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes('multiple blanks')));
});

test('CLI validates examples and reports failed input/arguments with exit code 1', () => {
  assert.equal(spawnSync(process.execPath, [validatorPath, '--examples'], { encoding: 'utf8' }).status, 0);
  for (const args of [['--tests'], ['--wrong'], ['--against-project'], ['--examples', '--against-project'], ['--tests', 'missing-data-file.json']]) {
    const result = spawnSync(process.execPath, [validatorPath, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Validation failed/);
  }
});

test('CLI detects project collisions when an additions file reuses existing IDs', () => {
  const existingPath = fileURLToPath(new URL('../public/tests/terminology.json', import.meta.url));
  const result = spawnSync(process.execPath, [validatorPath, '--terminology', existingPath, '--against-project'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate id/);
});
