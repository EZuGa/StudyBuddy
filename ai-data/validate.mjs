import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(kitDirectory, '..');
const ajv = new Ajv({ allErrors: true, strict: true });
const validators = Object.fromEntries(['tests', 'terminology'].map((kind) => [
  kind, ajv.compile(readJson(resolve(kitDirectory, `${kind}.schema.json`))),
]));

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function normalize(value) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
}

function normalizeTerm(value) {
  return normalize(value.replace(/[-‐‑–—]/g, ' '));
}

function normalizeDisplay(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function duplicateValues(values, normalizer = normalize) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizer(value);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

export function validateDocuments(documents) {
  const errors = [];
  const warnings = [];
  const testIds = new Map();
  const questionIds = new Map();
  const registerId = (map, id, location) => {
    if (map.has(id)) errors.push(`${location}: duplicate id "${id}"; also found at ${map.get(id)}.`);
    else map.set(id, location);
  };

  for (const { kind, data, label = kind } of documents) {
    const validate = validators[kind];
    if (!validate) { errors.push(`${label}: unknown collection kind "${kind}".`); continue; }
    if (!validate(data)) {
      for (const error of validate.errors ?? []) {
        const field = error.params.missingProperty ?? error.params.additionalProperty;
        errors.push(`${label}${error.instancePath || '/'}: ${error.message}${field ? ` (${field})` : ''}.`);
      }
      continue;
    }

    data.forEach((quiz, quizIndex) => {
      const location = `${label}/${quizIndex}`;
      registerId(testIds, quiz.id, location);
      const seenTerms = new Set();
      const seenPrompts = new Set();
      quiz.questions.forEach((question, questionIndex) => {
        const path = `${location}/questions/${questionIndex}`;
        registerId(questionIds, question.id, path);

        if (kind === 'terminology') {
          const key = normalizeTerm(question.term);
          if (!key) errors.push(`${path}: term must remain non-empty after answer normalization.`);
          if (seenTerms.has(key)) errors.push(`${path}: duplicate term "${question.term}" within this quiz.`);
          seenTerms.add(key);
          const alternatives = question.acceptedTerms ?? [];
          if (alternatives.some((answer) => !normalizeTerm(answer))) errors.push(`${path}: acceptedTerms contains an empty normalized answer.`);
          if (duplicateValues(alternatives, normalizeTerm).length) errors.push(`${path}: acceptedTerms repeats an equivalent answer.`);
          const definition = normalizeTerm(question.definition);
          const leaksAnswer = [question.term, ...alternatives].some((answer) => {
            const escaped = normalizeTerm(answer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return escaped && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(definition);
          });
          if (leaksAnswer) warnings.push(`${path}: the definition may reveal the term or an accepted alias; review it for reverse practice.`);
          return;
        }

        const prompt = normalize(question.prompt);
        if (seenPrompts.has(prompt)) warnings.push(`${path}: repeated question prompt; check whether this adds useful coverage.`);
        seenPrompts.add(prompt);
        if (question.options && duplicateValues(question.options, normalizeDisplay).length) errors.push(`${path}: options contain equivalent duplicate text.`);
        if (question.type === 'multiple-choice' && question.correctAnswer >= question.options.length) errors.push(`${path}/correctAnswer: index ${question.correctAnswer} is outside options; valid indexes are 0–${question.options.length - 1}.`);
        if (question.type === 'multiple-select' && question.correctAnswers.some((index) => index >= question.options.length)) errors.push(`${path}/correctAnswers: every index must be between 0 and ${question.options.length - 1}.`);
        if (question.type === 'matching') {
          if (duplicateValues(question.pairs.map((pair) => pair.term), normalizeDisplay).length) errors.push(`${path}/pairs: matching terms must be distinct.`);
          if (duplicateValues(question.pairs.map((pair) => pair.definition), normalizeDisplay).length) errors.push(`${path}/pairs: matching definitions must be distinct.`);
        }
        if (question.type === 'fill-blank') {
          if (question.acceptedAnswers.some((answer) => !normalize(answer))) errors.push(`${path}: acceptedAnswers contains an empty normalized answer.`);
          if (duplicateValues(question.acceptedAnswers).length) errors.push(`${path}: acceptedAnswers repeats an equivalent answer.`);
          if ((question.prompt.match(/_{2,}/g) ?? []).length > 1) warnings.push(`${path}: multiple blanks share one text field; prefer one blank per question.`);
        }
      });
    });
  }
  return { errors, warnings };
}

const usage = `StudyDeck data validator (read-only)
  npm run validate:data
  npm run validate:data -- --examples
  npm run validate:data -- --tests path/to/tests.additions.json --terminology path/to/terminology.additions.json --against-project

Either input flag can be used alone. --against-project checks additions for ID
collisions with existing quizzes; do not use it for complete replacement files.
Warnings require human review but do not fail validation. Errors exit with code 1.
This checks structure and consistency, not factual accuracy against a chapter.`;

export function runCli(args = process.argv.slice(2)) {
  try {
    const inputs = [];
    let examples = false;
    let againstProject = false;
    for (let index = 0; index < args.length; index++) {
      const argument = args[index];
      if (argument === '--help' || argument === '-h') { console.log(usage); return 0; }
      if (argument === '--examples') { examples = true; continue; }
      if (argument === '--against-project') { againstProject = true; continue; }
      if (argument === '--tests' || argument === '--terminology') {
        const path = args[++index];
        if (!path || path.startsWith('--')) throw new Error(`${argument} requires a file path.`);
        const kind = argument.slice(2);
        if (inputs.some((input) => input.kind === kind)) throw new Error(`${argument} may be supplied only once.`);
        inputs.push({ kind, path: resolve(path) });
        continue;
      }
      throw new Error(`Unknown argument: ${argument}. Use --help.`);
    }
    if (examples && (inputs.length || againstProject)) throw new Error('--examples cannot be combined with other input options.');
    if (againstProject && !inputs.length) throw new Error('--against-project requires at least one additions file.');
    const projectInputs = ['tests', 'terminology'].map((kind) => ({ kind, path: resolve(projectDirectory, `public/tests/${kind}.json`) }));
    const selected = examples ? ['tests', 'terminology'].map((kind) => ({ kind, path: resolve(kitDirectory, `examples/${kind}.example.json`) })) : inputs.length ? inputs : projectInputs;
    const documents = [...(againstProject ? projectInputs : []), ...selected].map(({ kind, path }) => ({ kind, label: path, data: readJson(path) }));
    const { errors, warnings } = validateDocuments(documents);
    warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
    if (errors.length) {
      errors.slice(0, 30).forEach((error) => console.error(`ERROR ${error}`));
      if (errors.length > 30) console.error(`...and ${errors.length - 30} more schema errors.`);
      console.error(`Validation failed: ${errors.length} error(s). No files changed.`);
      return 1;
    }
    console.log(`Valid: ${documents.reduce((total, document) => total + document.data.length, 0)} quizzes across ${documents.length} file(s); ${warnings.length} review warning(s). No files changed.`);
    console.log('Next: review the answers against the source chapter before adding them.');
    return 0;
  } catch (error) {
    console.error(`Validation failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runCli();
