import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TestDataService } from './test-data.service';

describe('TestDataService', () => {
  let service: TestDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), TestDataService] });
    service = TestBed.inject(TestDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads chapter and terminology quizzes from separate project files', async () => {
    const result = firstValueFrom(service.loadTests());
    http.expectOne('/tests/tests.json').flush([
      { id: 'chapter-1', subject: 'Networking', title: 'Chapter 1', chapters: ['Chapter 1'], questions: [{ id: 'q1', type: 'multiple-choice', prompt: 'Pick one.', options: ['A', 'B'], correctAnswer: 0 }] },
    ]);
    http.expectOne('/tests/terminology.json').flush([
      { id: 'terms-1', subject: 'Networking', title: 'Terminology', chapters: ['Chapter 1'], questions: [{ id: 'term-1', type: 'written', prompt: 'Define LAN.', exampleAnswer: 'A local area network.' }] },
    ]);
    expect((await result).map((test) => [test.id, test.category])).toEqual([['chapter-1', 'general'], ['terms-1', 'terminology']]);
  });

  it('allows empty project collections without accepting empty imports', async () => {
    const result = firstValueFrom(service.loadTests());
    http.expectOne('/tests/tests.json').flush([]);
    http.expectOne('/tests/terminology.json').flush([]);
    expect(await result).toEqual([]);
    expect(() => service.parseTests([])).toThrowError(/does not contain any tests/);
  });

  it('enforces written-only questions in the terminology file even without a category', async () => {
    const result = expect(firstValueFrom(service.loadTests())).rejects.toThrow(/Every question must be a written response/);
    http.expectOne('/tests/tests.json').flush([]);
    http.expectOne('/tests/terminology.json').flush([
      { id: 'bad-term', subject: 'Networking', title: 'Invalid terminology', chapters: ['Chapter 1'], questions: [{ id: 'q1', type: 'multiple-choice', prompt: 'Pick one.', options: ['A', 'B'], correctAnswer: 0 }] },
    ]);
    await result;
  });

  it('reports a missing terminology file instead of silently omitting it', async () => {
    const result = expect(firstValueFrom(service.loadTests())).rejects.toMatchObject({ status: 404 });
    http.expectOne('/tests/tests.json').flush([]);
    http.expectOne('/tests/terminology.json').flush('Missing', { status: 404, statusText: 'Not Found' });
    await result;
  });

  it('parses fill-in-the-blank and matching questions', () => {
    const [test] = service.parseTests({
      id: 'mixed-test', subject: 'Science', title: 'Mixed formats', chapters: ['Chapter 1'],
      questions: [
        { id: 'fill', type: 'fill-blank', prompt: 'Water is _____.', acceptedAnswers: ['H2O', 'H₂O'] },
        { id: 'match', type: 'matching', prompt: 'Match the pairs.', pairs: [{ term: 'Atom', definition: 'Smallest unit of an element' }, { term: 'Ion', definition: 'Charged atom' }] },
      ],
    });

    expect(test.questions.map((question) => question.type)).toEqual(['fill-blank', 'matching']);
    expect(test.questions[1].pairs).toHaveLength(2);
  });

  it('rejects a fill-in-the-blank question without accepted answers', () => {
    expect(() => service.parseTests({
      id: 'broken', subject: 'Science', title: 'Broken test', chapters: ['Chapter 1'],
      questions: [{ id: 'fill', type: 'fill-blank', prompt: 'Missing answers' }],
    })).toThrowError(/acceptedAnswers/);
  });

  it('preserves all multi-select options, answer indices, and question numbers', () => {
    const [test] = service.parseTests({
      id: 'hardware', subject: 'Networking', title: 'Chapter 2', chapters: ['Chapter 2'],
      questions: [{ id: 'q71', number: '71', type: 'multiple-select', prompt: 'Choose all.', options: ['A', 'B', 'C'], correctAnswers: [0, 2] }],
    });
    expect(test.questions[0]).toMatchObject({ number: '71', type: 'multiple-select', options: ['A', 'B', 'C'], correctAnswers: [0, 2] });
  });

  it.each([undefined, [], [0, 0], [-1], [3], [0.5], ['0']])('rejects invalid multi-select keys: %j', (correctAnswers) => {
    expect(() => service.parseTests({
      id: 'broken', subject: 'Networking', title: 'Broken test', chapters: ['Chapter 2'],
      questions: [{ id: 'multi', type: 'multiple-select', prompt: 'Choose all.', options: ['A', 'B', 'C'], correctAnswers }],
    })).toThrowError(/correctAnswers/);
  });

  it('recognizes terminology quizzes without changing ordinary chapter tests', () => {
    const quizzes = service.parseTests([
      { id: 'terms', category: 'terminology', subject: 'Networking', title: 'Terms', chapters: ['Chapter 1'], questions: [{ id: 'term', type: 'written', prompt: 'Define LAN.', exampleAnswer: 'A local area network.' }] },
      { id: 'chapter', subject: 'Networking', title: 'Chapter test', chapters: ['Chapter 1'], questions: [{ id: 'choice', type: 'multiple-choice', prompt: 'Select one.', options: ['A', 'B'], correctAnswer: 0 }] },
    ]);
    expect(quizzes.map((test) => test.category)).toEqual(['terminology', 'general']);
  });

  it('places untagged written-only imports into the terminology collection', () => {
    const [quiz] = service.parseTests({ id: 'terms', subject: 'Networking', title: 'Terms', chapters: ['Chapter 1'], questions: [{ id: 'term', type: 'written', prompt: 'Define LAN.', exampleAnswer: 'A local area network.' }] }, true);
    expect(quiz.category).toBe('terminology');
    expect(quiz.questions[0].type).toBe('written');
  });

  it.each([
    { type: 'multiple-choice', options: ['A', 'B'], correctAnswer: 0 },
    { type: 'multiple-select', options: ['A', 'B'], correctAnswers: [0, 1] },
    { type: 'matching', pairs: [{ term: 'A', definition: 'One' }, { term: 'B', definition: 'Two' }] },
    { type: 'fill-blank', acceptedAnswers: ['LAN'] },
  ])('rejects $type questions from terminology imports and saved quizzes', (question) => {
    const quiz = { id: 'terms', subject: 'Networking', title: 'Terms', chapters: ['Chapter 1'], questions: [{ id: 'term', prompt: 'Test prompt', ...question }] };
    expect(() => service.parseTests(quiz, true)).toThrowError(/Every question must be a written response/);
    expect(() => service.parseTests({ ...quiz, category: 'terminology' })).toThrowError(/Every question must be a written response/);
  });
});
