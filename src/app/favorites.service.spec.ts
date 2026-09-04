import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';
import { TestDefinition } from './models';

const key = 'studydeck-favorites-v1';
const test: TestDefinition = {
  id: 'networking', subject: 'Networking', title: 'Chapter 1', chapters: ['Chapter 1'], kind: 'chapter', minutes: 5, tone: 'sage',
  questions: [
    { id: 'q1', type: 'written', prompt: 'First question', exampleAnswer: 'First answer' },
    { id: 'q2', type: 'written', prompt: 'Second question', exampleAnswer: 'Second answer' },
  ],
};

describe('FavoritesService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [FavoritesService] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('toggles individual questions within their own test and stores only references', () => {
    const service = TestBed.inject(FavoritesService);
    service.toggle(test.id, 'q1');
    service.toggle('another-test', 'q1');
    service.toggle(test.id, 'q1');
    expect(service.has(test.id, 'q1')).toBe(false);
    expect(service.has('another-test', 'q1')).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ testId: 'another-test', questionId: 'q1' }]);
  });

  it('restores favorites after reload and returns shared questions in source order', () => {
    const service = TestBed.inject(FavoritesService);
    service.toggle(test.id, 'q2');
    service.toggle(test.id, 'q1');
    const reloaded = new FavoritesService();
    expect(reloaded.questionsFor(test)).toEqual(test.questions);
    expect(reloaded.questionsFor(test)[0]).toBe(test.questions[0]);
  });

  it('ignores invalid, duplicate, and stale references without changing source content', () => {
    localStorage.setItem(key, JSON.stringify([
      null, 1, { testId: test.id }, { testId: '', questionId: 'q1' },
      { testId: test.id, questionId: 'q2' }, { testId: test.id, questionId: 'q2' },
      { testId: test.id, questionId: 'removed' },
    ]));
    const service = TestBed.inject(FavoritesService);
    const original = JSON.stringify(test);
    expect(service.questionsFor(test)).toEqual([test.questions[1]]);
    service.toggle(test.id, 'q2');
    expect(service.questionsFor(test)).toEqual([]);
    expect(JSON.stringify(test)).toBe(original);
  });

  it('handles malformed saved JSON and unexpected top-level values', () => {
    localStorage.setItem(key, '{bad json');
    const service = TestBed.inject(FavoritesService);
    expect(service.questionsFor(test)).toEqual([]);
    expect(service.storageNotice()).toContain('could not be loaded');
    localStorage.setItem(key, '{}');
    expect(new FavoritesService().questionsFor(test)).toEqual([]);
  });

  it('still works in memory when browser storage is blocked and reports the limitation', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    const service = TestBed.inject(FavoritesService);
    service.toggle(test.id, 'q1');
    expect(service.has(test.id, 'q1')).toBe(true);
    expect(service.storageNotice()).toContain('only for this session');
    service.toggle(test.id, 'q1');
    expect(service.has(test.id, 'q1')).toBe(false);
  });
});
