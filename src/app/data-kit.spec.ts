import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import libraryExample from '../../ai-data/examples/library.example.json';
import { TestDataService } from './test-data.service';

describe('AI data kit compatibility', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), TestDataService] }));

  it('imports the complete ordinary example through the real application parser', () => {
    const [quiz] = TestBed.inject(TestDataService).parseTests(libraryExample);
    expect(quiz.category).toBe('general');
    expect(quiz.questions.map((question) => question.type)).toEqual(['multiple-choice', 'multiple-select', 'written', 'matching', 'fill-blank']);
    expect(quiz.questions[0].correctAnswer).toBe(1);
    expect(quiz.questions[1].correctAnswers).toEqual([0, 1]);
    expect(quiz.questions[3].pairs).toHaveLength(2);
  });

  it('imports the shared terminology example without a second reverse collection', () => {
    const quiz = TestBed.inject(TestDataService).parseTests(libraryExample)[1];
    const source = libraryExample[0].terminology.questions[0];
    const definition = 'definition' in source ? source.definition : undefined;
    expect(definition).toEqual(expect.any(String));
    expect(quiz.category).toBe('terminology');
    expect(quiz.questions).toHaveLength(3);
    expect(quiz.questions[0]).toMatchObject({ type: 'written', term: 'LAN', prompt: 'Define “LAN” in your own words.', exampleAnswer: definition, acceptedTerms: ['Local area network'] });
    expect(quiz.questions.every((question) => question.type === 'written' && question.term && question.exampleAnswer)).toBe(true);
  });
});
