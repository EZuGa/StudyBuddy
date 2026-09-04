import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { FavoritesService } from './favorites.service';
import { TestDefinition, TestQuestion } from './models';
import { TestDataService } from './test-data.service';

const questions: TestQuestion[] = [
  { id: 'choice', number: '1', type: 'multiple-choice', prompt: 'Choose one.', options: ['A', 'B'], correctAnswer: 1 },
  { id: 'select', number: '2', type: 'multiple-select', prompt: 'Choose several.', options: ['A', 'B'], correctAnswers: [0, 1] },
  { id: 'blank', number: '3', type: 'fill-blank', prompt: 'Fill ____.', acceptedAnswers: ['word'] },
  { id: 'written', number: '4', type: 'written', prompt: 'Explain.', exampleAnswer: 'An explanation.' },
  { id: 'matching', number: '5', type: 'matching', prompt: 'Match pairs.', pairs: [{ term: 'A', definition: 'First' }, { term: 'B', definition: 'Second' }] },
];
const quiz: TestDefinition = { id: 'quiz', subject: 'Networking', title: 'Chapter 1', chapters: ['Chapter 1'], kind: 'chapter', minutes: 10, tone: 'sky', questions };
const terms: TestDefinition = {
  ...quiz, id: 'terms', category: 'terminology',
  questions: ['LAN', 'WAN', 'NIC'].map((term) => ({ id: term, type: 'written', term, prompt: `Define ${term}.`, exampleAnswer: `${term} definition.` })),
};
const textEvent = (value: string) => ({ target: { value } }) as unknown as Event;

describe('Random question order', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: TestDataService, useValue: { loadTests: () => of([quiz, terms]) } }],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  for (const test of [quiz, terms]) {
    for (const scope of ['all', 'favorites'] as const) {
      for (const direction of (test.category === 'terminology' ? ['define', 'recall'] : ['define']) as Array<'define' | 'recall'>) {
        it.each(['instant', 'end'] as const)(`shuffles ${test.id}, ${scope}, ${direction} with %s feedback`, (mode) => {
          const app = TestBed.createComponent(App).componentInstance;
          const favorites = TestBed.inject(FavoritesService);
          const source = JSON.stringify(test);
          const selected = scope === 'all' ? test.questions : [test.questions[0], test.questions[2]];
          if (scope === 'favorites') selected.forEach((question) => favorites.toggle(test.id, question.id));
          app['openTestSetup'](test, direction, scope);
          app['selectedMode'].set(mode);
          expect(app['setupTest']()?.questions).toEqual(selected);
          expect(Math.random).not.toHaveBeenCalled();
          app['startChosenTest']();

          const session = app['activeTest']()!;
          expect(session.questions).toEqual([...selected.slice(1), selected[0]]);
          expect(new Set(session.questions.map((question) => question.id)).size).toBe(selected.length);
          session.questions.forEach((question) => expect(test.questions).toContain(question));
          expect(session.questions).not.toBe(test.questions);
          expect(app['activeSourceTest']()).toBe(test);
          expect(app['selectedMode']()).toBe(mode);
          expect(app['selectedDirection']()).toBe(direction);
          expect(JSON.stringify(test)).toBe(source);
          expect(Math.random).toHaveBeenCalledTimes(selected.length - 1);
        });
      }
    }
  }

  it('keeps navigation and review in session order and scores answers by ID', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app['beginTest'](quiz, 'end');
    const order = app['activeTest']()!.questions;
    expect(order).toEqual([questions[1], questions[2], questions[3], questions[4], questions[0]]);
    app['toggleChoice'](questions[1], 0);
    app['toggleChoice'](questions[1], 1);
    app['nextQuestion']();
    app['updateWritten'](questions[2], textEvent('word'));
    app['previousQuestion']();
    expect(app['currentQuestion']()).toBe(questions[1]);
    expect(app['answerFor']('select').choices).toEqual([0, 1]);
    app['nextQuestion']();
    expect(app['answerFor']('blank').text).toBe('word');
    app['nextQuestion']();
    app['updateWritten'](questions[3], textEvent('My explanation'));
    app['nextQuestion']();
    app['chooseMatch'](questions[4], 0, textEvent('0'));
    app['chooseMatch'](questions[4], 1, textEvent('1'));
    app['nextQuestion']();
    app['chooseAnswer'](questions[0], 1);
    app['nextQuestion']();
    expect(app['page']()).toBe('written-review');
    expect(app['reviewQuestion']()).toBe(questions[3]);
    app['gradeReview'](true);
    fixture.detectChanges();
    expect(app['result']()).toMatchObject({ testId: quiz.id, score: 6, total: 6, percentage: 100 });
    expect(app['activeTest']()!.questions).toBe(order);
    expect(Math.random).toHaveBeenCalledTimes(questions.length - 1);
    expect(app['latestFor'](quiz.id)?.percentage).toBe(100);
  });

  it.each([quiz, terms])('reshuffles $id on retry without changing the previous session', (test) => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest'](test, 'end');
    const first = app['activeTest']()!.questions;
    const firstOrder = [...first];
    vi.mocked(Math.random).mockReturnValue(0.999);
    app['retryTest']();
    if (app['chooserTest']()) app['startChosenTest']();
    expect(app['activeTest']()!.questions).toEqual(test.questions);
    expect(app['activeTest']()!.questions).not.toEqual(first);
    expect(first).toEqual(firstOrder);
    expect(app['answers']()).toEqual({});
    expect(app['currentIndex']()).toBe(0);
  });

  it('keeps a single-question test usable without needing a random swap', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest']({ ...quiz, questions: [questions[0]] }, 'instant');
    expect(app['currentQuestion']()).toBe(questions[0]);
    expect(Math.random).not.toHaveBeenCalled();
    app['chooseAnswer'](questions[0], 1);
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ score: 1, total: 1 });
  });
});
