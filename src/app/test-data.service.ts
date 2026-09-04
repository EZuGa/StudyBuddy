import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { TestDefinition, TestQuestion } from './models';

@Injectable({ providedIn: 'root' })
export class TestDataService {
  private readonly http = inject(HttpClient);

  loadTests(): Observable<TestDefinition[]> {
    return this.http.get<unknown>('/tests/library.json').pipe(map((data) =>
      Array.isArray(data) && data.length === 0 ? [] : this.parseTests(data),
    ));
  }

  parseTests(data: unknown, terminologyOnly = false): TestDefinition[] {
    const candidates = Array.isArray(data) ? data : [data];
    if (!candidates.length) throw new Error('The file does not contain any tests.');
    const chapterIds = new Set<string>();
    const chapterNames = new Set<string>();
    const tests = candidates.flatMap((candidate, index) => {
      // Older flat quiz files remain importable; project data is chapter-owned.
      if (candidate && typeof candidate === 'object' && !('questions' in candidate)) {
        const chapter = candidate as Record<string, unknown>;
        const parsed = this.parseChapter(chapter, index);
        const name = JSON.stringify([chapter['subject'], chapter['title'], chapter['kind']]);
        if (chapterIds.has(String(chapter['id'])) || chapterNames.has(name)) throw new Error('Combine quiz and terminology inside one object per chapter.');
        chapterIds.add(String(chapter['id']));
        chapterNames.add(name);
        return parsed;
      }
      const test = this.parseTest(candidate, index);
      if (terminologyOnly) test.category = 'terminology';
      return [test];
    });
    const testIds = new Set<string>();
    for (const test of tests) {
      if (testIds.has(test.id)) throw new Error(`Duplicate quiz id “${test.id}”. Each quiz needs its own stable id.`);
      testIds.add(test.id);
      if (test.category === 'terminology' && test.questions.some((question) => question.type !== 'written')) {
        throw new Error(`“${test.title}” is a terminology quiz. Every question must be a written response with an exampleAnswer.`);
      }
    }
    return tests;
  }

  private parseChapter(chapter: Record<string, unknown>, index: number): TestDefinition[] {
    for (const key of ['id', 'subject', 'title']) {
      if (typeof chapter[key] !== 'string' || !chapter[key].trim()) throw new Error(`Chapter ${index + 1} needs a ${key}.`);
    }
    if (!['chapter', 'midterm'].includes(String(chapter['kind']))) throw new Error(`“${chapter['title']}” needs kind chapter or midterm.`);
    const allowed = ['id', 'subject', 'title', 'kind', 'chapters', 'quiz', 'terminology'];
    if (Object.keys(chapter).some((key) => !allowed.includes(key))) throw new Error(`“${chapter['title']}” contains an unsupported chapter field.`);
    let chapters = [String(chapter['title'])];
    if (chapter['kind'] === 'midterm') {
      const covered = chapter['chapters'];
      if (!Array.isArray(covered) || covered.length < 2 || covered.some((name) => typeof name !== 'string' || !name.trim()) || new Set(covered).size !== covered.length) {
        throw new Error(`“${chapter['title']}” needs at least two distinct covered chapters.`);
      }
      chapters = covered as string[];
    } else if ('chapters' in chapter) {
      throw new Error('A chapter uses its title as the chapter label; only midterms need a chapters array.');
    }
    const quizzes: TestDefinition[] = [];
    for (const key of ['quiz', 'terminology'] as const) {
      if (!(key in chapter)) continue;
      const value = chapter[key];
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`“${chapter['title']}” needs a valid ${key} object.`);
      const content = value as Record<string, unknown>;
      if (Object.keys(content).some((field) => !['id', 'title', 'minutes', 'tone', 'questions'].includes(field))) {
        throw new Error(`The ${key} in “${chapter['title']}” must inherit subject and chapter details from its parent; remove unsupported fields.`);
      }
      if (key === 'terminology' && Array.isArray(content['questions']) && content['questions'].some((entry) => !entry || typeof entry !== 'object' || entry.type !== 'written' || typeof entry.term !== 'string' || typeof entry.definition !== 'string')) {
        throw new Error('Terminology must contain shared written term and definition entries only.');
      }
      quizzes.push(this.parseTest({ ...content, category: key === 'quiz' ? 'general' : 'terminology', subject: chapter['subject'], chapters, kind: chapter['kind'] }, index));
    }
    if (!quizzes.length) throw new Error(`“${chapter['title']}” needs quiz or terminology data inside it.`);
    return quizzes;
  }

  private parseTest(value: unknown, index: number): TestDefinition {
    if (!value || typeof value !== 'object') throw new Error(`Test ${index + 1} is not a valid object.`);
    const item = value as Record<string, unknown>;
    const required = ['id', 'subject', 'title'];
    for (const key of required) {
      if (typeof item[key] !== 'string' || !item[key]) throw new Error(`Test ${index + 1} needs a ${key}.`);
    }
    if (!Array.isArray(item['chapters']) || !item['chapters'].length || !item['chapters'].every((part) => typeof part === 'string' && part.trim())) {
      throw new Error(`“${item['title']}” needs a non-empty chapters array.`);
    }
    if (!Array.isArray(item['questions']) || !item['questions'].length) {
      throw new Error(`“${item['title']}” needs at least one question.`);
    }
    const questions = item['questions'].map((question, questionIndex) =>
      this.parseQuestion(question, String(item['title']), questionIndex),
    );
    return {
      id: String(item['id']),
      category: item['category'] === 'terminology' ? 'terminology' : 'general',
      subject: String(item['subject']),
      title: String(item['title']),
      chapters: item['chapters'] as string[],
      kind: item['kind'] === 'midterm' ? 'midterm' : 'chapter',
      minutes: typeof item['minutes'] === 'number' ? item['minutes'] : Math.max(5, questions.length * 2),
      tone: this.isTone(item['tone']) ? item['tone'] : 'coral',
      questions,
    };
  }

  private parseQuestion(value: unknown, title: string, index: number): TestQuestion {
    if (!value || typeof value !== 'object') throw new Error(`Question ${index + 1} in “${title}” is invalid.`);
    const item = value as Record<string, unknown>;
    if ('term' in item || 'definition' in item) {
      if (item['type'] !== 'written' || typeof item['id'] !== 'string' || !item['id'].trim() || typeof item['term'] !== 'string' || !item['term'].trim() || typeof item['definition'] !== 'string' || !item['definition'].trim()) {
        throw new Error(`Terminology question ${index + 1} needs type written, an id, a term, and a definition.`);
      }
      if (item['acceptedTerms'] !== undefined && (!Array.isArray(item['acceptedTerms']) || !item['acceptedTerms'].every((term) => typeof term === 'string' && term.trim()))) {
        throw new Error(`Terminology question ${index + 1} needs an acceptedTerms array of non-empty strings.`);
      }
      return {
        id: item['id'], number: typeof item['number'] === 'string' ? item['number'] : undefined,
        type: 'written', term: item['term'].trim(), acceptedTerms: item['acceptedTerms'] as string[] | undefined,
        prompt: `Define “${item['term'].trim()}” in your own words.`, exampleAnswer: item['definition'].trim(),
      };
    }
    if (typeof item['id'] !== 'string' || typeof item['prompt'] !== 'string') {
      throw new Error(`Question ${index + 1} in “${title}” needs an id and prompt.`);
    }
    const number = typeof item['number'] === 'string' ? item['number'] : undefined;
    if (item['type'] === 'written') {
      if (typeof item['exampleAnswer'] !== 'string') throw new Error(`Written question ${index + 1} needs an exampleAnswer.`);
      return { id: item['id'], number, prompt: item['prompt'], type: 'written', exampleAnswer: item['exampleAnswer'], explanation: typeof item['explanation'] === 'string' ? item['explanation'] : undefined };
    }
    if (item['type'] === 'fill-blank') {
      if (!Array.isArray(item['acceptedAnswers']) || !item['acceptedAnswers'].length || !item['acceptedAnswers'].every((answer) => typeof answer === 'string')) {
        throw new Error(`Fill-in-the-blank question ${index + 1} needs an acceptedAnswers array.`);
      }
      return { id: item['id'], number, prompt: item['prompt'], type: 'fill-blank', acceptedAnswers: item['acceptedAnswers'] as string[], explanation: typeof item['explanation'] === 'string' ? item['explanation'] : undefined };
    }
    if (item['type'] === 'matching') {
      if (!Array.isArray(item['pairs']) || item['pairs'].length < 2 || !item['pairs'].every((pair) => pair && typeof pair === 'object' && typeof (pair as Record<string, unknown>)['term'] === 'string' && typeof (pair as Record<string, unknown>)['definition'] === 'string')) {
        throw new Error(`Matching question ${index + 1} needs at least two term and definition pairs.`);
      }
      return { id: item['id'], number, prompt: item['prompt'], type: 'matching', pairs: item['pairs'] as Array<{ term: string; definition: string }>, explanation: typeof item['explanation'] === 'string' ? item['explanation'] : undefined };
    }
    if (!Array.isArray(item['options']) || item['options'].length < 2 || !item['options'].every((option) => typeof option === 'string')) {
      throw new Error(`Multiple-choice question ${index + 1} needs at least two options.`);
    }
    if (item['type'] === 'multiple-select') {
      const answers = item['correctAnswers'];
      const optionCount = item['options'].length;
      if (!Array.isArray(answers) || !answers.length || new Set(answers).size !== answers.length || !answers.every((answer) => Number.isInteger(answer) && answer >= 0 && answer < optionCount)) {
        throw new Error(`Multiple-select question ${index + 1} needs unique, valid correctAnswers indices.`);
      }
      return { id: item['id'], number, prompt: item['prompt'], type: 'multiple-select', options: item['options'] as string[], correctAnswers: answers as number[], explanation: typeof item['explanation'] === 'string' ? item['explanation'] : undefined };
    }
    if (typeof item['correctAnswer'] !== 'number' || !Number.isInteger(item['correctAnswer']) || item['correctAnswer'] < 0 || item['correctAnswer'] >= item['options'].length) {
      throw new Error(`Multiple-choice question ${index + 1} has an invalid correctAnswer.`);
    }
    return { id: item['id'], number, prompt: item['prompt'], type: 'multiple-choice', options: item['options'] as string[], correctAnswer: item['correctAnswer'], explanation: typeof item['explanation'] === 'string' ? item['explanation'] : undefined };
  }

  private isTone(value: unknown): value is TestDefinition['tone'] {
    return ['sage', 'sky', 'amber', 'lilac', 'coral'].includes(String(value));
  }
}
