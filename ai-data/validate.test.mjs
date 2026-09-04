import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, validateDocuments } from './validate.mjs';

const exampleLibrary = readJson(new URL('./examples/library.example.json', import.meta.url));
const exampleTests = exampleLibrary.map(({ terminology, ...chapter }) => chapter);
const exampleTerms = exampleLibrary.map(({ quiz, ...chapter }) => ({ ...chapter, id: chapter.id + '-terms', title: chapter.title + ' terms only' }));
const validatorPath = fileURLToPath(new URL('./validate.mjs', import.meta.url));
const testsDocument = (data) => ({ label: 'general-additions', data });
const termsDocument = (data) => ({ label: 'terminology-additions', data });
const checkQuestion = (update) => {
  const data = structuredClone(exampleTests);
  update(data[0].quiz.questions, data[0].quiz, data[0]);
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
    { label: 'library.json', data: readJson(new URL('../public/tests/library.json', import.meta.url)) },
  ]);
  assert.deepEqual(result.errors, []);
});

test('only arrays are accepted, including empty project arrays', () => {
  hasError(validateDocuments([testsDocument(exampleTests[0])]), /must be array/);
  assert.deepEqual(validateDocuments([testsDocument([]), termsDocument([])]).errors, []);
});

test('unknown fields, quiz kinds, and question types are rejected', () => {
  hasError(checkQuestion((questions, quiz) => { quiz.score = 100; }), /additional properties/);
  hasError(checkQuestion((questions, quiz, chapter) => { chapter.kind = 'final'; }), /allowed values/);
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
  terms[0].terminology.id = exampleTests[0].quiz.id;
  terms[0].terminology.questions[0].id = exampleTests[0].quiz.questions[0].id;
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
  terms[0].terminology.questions[0].prompt = 'Define LAN.';
  hasError(validateDocuments([termsDocument(terms)]), /additional properties/);
  delete terms[0].terminology.questions[0].prompt;
  terms[0].terminology.questions[0].type = 'multiple-choice';
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
    change(terms[0].terminology.questions);
    assert.ok(validateDocuments([termsDocument(terms)]).errors.length);
  }
});

test('definition answer leaks are review warnings, not asserted factual failures', () => {
  const terms = structuredClone(exampleTerms);
  terms[0].terminology.questions[0].definition = 'LAN means local area network.';
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
  for (const args of [['--library'], ['--wrong'], ['--against-project'], ['--examples', '--against-project'], ['--library', 'missing-data-file.json']]) {
    const result = spawnSync(process.execPath, [validatorPath, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Validation failed/);
  }
});

test('CLI detects project collisions when an additions file reuses existing IDs', () => {
  const existingPath = fileURLToPath(new URL('../public/tests/library.json', import.meta.url));
  const result = spawnSync(process.execPath, [validatorPath, '--library', existingPath, '--against-project'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate id/);
});

test('one chapter contains both activities with no duplicated chapter metadata', () => {
  assert.deepEqual(validateDocuments([{ data: exampleLibrary }]), { errors: [], warnings: [] });
  const flat = [exampleLibrary[0].quiz, exampleLibrary[0].terminology];
  hasError(validateDocuments([{ data: flat }]), /subject/);
  const duplicated = structuredClone(exampleLibrary);
  duplicated[0].quiz.subject = 'Other subject';
  hasError(validateDocuments([{ data: duplicated }]), /additional properties/);
});

test('separate objects for the same chapter are rejected', () => {
  const split = [structuredClone(exampleTests[0]), { ...structuredClone(exampleLibrary[0]), id: 'different-chapter-id' }];
  delete split[1].quiz;
  hasError(validateDocuments([{ data: split }]), /duplicate chapter/);
});

test('chapter entries need at least one non-empty activity', () => {
  for (const update of [
    (chapter) => { delete chapter.quiz; delete chapter.terminology; },
    (chapter) => { chapter.quiz.questions = []; },
    (chapter) => { chapter.terminology = null; },
    (chapter) => { chapter.quiz = []; },
  ]) {
    const data = structuredClone(exampleLibrary);
    update(data[0]);
    assert.ok(validateDocuments([{ data }]).errors.length);
  }
});

test('midterms own their activities once and list covered chapter titles', () => {
  const data = structuredClone(exampleLibrary);
  data[0].kind = 'midterm';
  data[0].chapters = ['Chapter 1', 'Chapter 2'];
  assert.deepEqual(validateDocuments([{ data }]).errors, []);
  for (const chapters of [undefined, [], ['Chapter 1'], ['Chapter 1', 'Chapter 1']]) {
    data[0].chapters = chapters;
    assert.ok(validateDocuments([{ data }]).errors.length);
  }
  data[0].kind = 'chapter';
  data[0].chapters = ['Chapter 1', 'Chapter 2'];
  assert.ok(validateDocuments([{ data }]).errors.length);
});
