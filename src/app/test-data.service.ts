import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { TestDefinition, TestQuestion } from './models';

@Injectable({ providedIn: 'root' })
export class TestDataService {
  private readonly http = inject(HttpClient);

  loadTests(): Observable<TestDefinition[]> {
    return this.http.get<unknown>('/tests/tests.json').pipe(map((data) => this.parseTests(data)));
  }

  parseTests(data: unknown): TestDefinition[] {
    const candidates = Array.isArray(data) ? data : [data];
    if (!candidates.length) throw new Error('The file does not contain any tests.');
    return candidates.map((candidate, index) => this.parseTest(candidate, index));
  }

  private parseTest(value: unknown, index: number): TestDefinition {
    if (!value || typeof value !== 'object') throw new Error(`Test ${index + 1} is not a valid object.`);
    const item = value as Record<string, unknown>;
    const required = ['id', 'subject', 'title'];
    for (const key of required) {
      if (typeof item[key] !== 'string' || !item[key]) throw new Error(`Test ${index + 1} needs a ${key}.`);
    }
    if (!Array.isArray(item['chapters']) || !item['chapters'].every((part) => typeof part === 'string')) {
      throw new Error(`“${item['title']}” needs a chapters array.`);
    }
    if (!Array.isArray(item['questions']) || !item['questions'].length) {
      throw new Error(`“${item['title']}” needs at least one question.`);
    }
    const questions = item['questions'].map((question, questionIndex) =>
      this.parseQuestion(question, String(item['title']), questionIndex),
    );
    return {
      id: String(item['id']),
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
    if (typeof item['correctAnswer'] !== 'number' || item['correctAnswer'] < 0 || item['correctAnswer'] >= item['options'].length) {
      throw new Error(`Multiple-choice question ${index + 1} has an invalid correctAnswer.`);
    }
    return { id: item['id'], number, prompt: item['prompt'], type: 'multiple-choice', options: item['options'] as string[], correctAnswer: item['correctAnswer'], explanation: typeof item['explanation'] === 'string' ? item['explanation'] : undefined };
  }

  private isTone(value: unknown): value is TestDefinition['tone'] {
    return ['sage', 'sky', 'amber', 'lilac', 'coral'].includes(String(value));
  }
}
