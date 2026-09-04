import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { FavoritesService } from './favorites.service';
import { TestDefinition, TestQuestion } from './models';
import { TestDataService } from './test-data.service';

const questions: TestQuestion[] = [
  { id: 'choice', type: 'multiple-choice', prompt: 'Choose one.', options: ['A', 'B'], correctAnswer: 1 },
  { id: 'select', type: 'multiple-select', prompt: 'Choose several.', options: ['A', 'B'], correctAnswers: [0, 1] },
  { id: 'blank', type: 'fill-blank', prompt: 'Fill ____.', acceptedAnswers: ['word'] },
  { id: 'written', type: 'written', prompt: 'Explain.', exampleAnswer: 'An explanation.' },
  { id: 'matching', type: 'matching', prompt: 'Match pairs.', pairs: [{ term: 'A', definition: 'First' }, { term: 'B', definition: 'Second' }] },
];
const quiz: TestDefinition = { id: 'quiz', subject: 'Networking', title: 'Chapter 1', chapters: ['Chapter 1'], kind: 'chapter', minutes: 10, tone: 'sage', questions };
const term: TestQuestion = { id: 'lan', type: 'written', term: 'LAN', prompt: 'Define LAN.', exampleAnswer: 'A network covering a small area.' };
const terms: TestDefinition = { ...quiz, id: 'terms', title: 'Terminology', category: 'terminology', questions: [{ ...term, id: 'wan', term: 'WAN', prompt: 'Define WAN.' }, term] };
const textEvent = (value: string) => ({ target: { value } }) as unknown as Event;

describe('Favorite question practice', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: TestDataService, useValue: { loadTests: () => of([quiz, terms]) } }],
    }).compileComponents();
  });

  it.each(questions)('shows an accessible favorite toggle on $type questions', (question) => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app['beginTest']({ ...quiz, questions: [question] }, 'end');
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.question-card app-favorite-button button')!;
    expect(button.getAttribute('aria-label')).toBe('Add question 1 to favorites');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('Favorited');
    expect(TestBed.inject(FavoritesService).has(quiz.id, question.id)).toBe(true);
    expect(app['answers']()).toEqual({});
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens a per-test favorites list and starts only saved questions from the library', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const favorites = TestBed.inject(FavoritesService);
    favorites.toggle(quiz.id, 'blank');
    favorites.toggle(quiz.id, 'choice');
    favorites.toggle(terms.id, 'lan');
    app['chooseSubject']('Networking');
    app['chooseChapter']('Chapter 1');
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.card-bottom .favorites-practice')!.click();
    fixture.detectChanges();
    expect(app['selectedScope']()).toBe('favorites');
    expect(root.querySelector('details')?.open).toBe(true);
    expect(root.querySelectorAll('.favorites-list li')).toHaveLength(2);
    expect(root.querySelector('.favorites-list')?.textContent).not.toContain('LAN');
    expect(root.querySelector('.mode-summary')?.textContent).toContain('2 questions');
    root.querySelector<HTMLButtonElement>('.start-mode')!.click();
    fixture.detectChanges();
    expect(app['activeTest']()?.questions).toEqual([questions[0], questions[2]]);
    expect(app['activeSourceTest']()).toBe(quiz);
    expect(root.querySelector('.favorites-badge')?.textContent).toContain('Favorites only');
    expect(root.querySelector('.question-count')?.textContent).toContain('Question 1 of 2');
  });

  it('disables empty favorites and blocks starting if the last favorite is removed', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    app['openTestSetup'](quiz);
    fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('[name="practice-scope"][value="favorites"]')!.disabled).toBe(true);
    TestBed.inject(FavoritesService).toggle(quiz.id, 'choice');
    app['openTestSetup'](quiz, 'define', 'favorites');
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.favorites-list app-favorite-button button')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.favorites-list')?.textContent).toContain('No favorites left');
    expect(root.querySelector<HTMLButtonElement>('.start-mode')!.disabled).toBe(true);
    app['startChosenTest']();
    expect(app['chooserTest']()).toBe(quiz);
    expect(app['activeTest']()).toBeNull();
    expect(() => app['beginTest'](quiz, 'end', 'define', 'favorites')).toThrow(/at least one favorite/);
    root.querySelector<HTMLInputElement>('[name="practice-scope"][value="all"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('.start-mode')!.disabled).toBe(false);
  });

  it('keeps a running favorites session stable and scores only its snapshot', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const favorites = TestBed.inject(FavoritesService);
    const original = JSON.stringify(quiz);
    favorites.toggle(quiz.id, 'choice');
    app['beginTest'](quiz, 'end', 'define', 'favorites');
    favorites.toggle(quiz.id, 'choice');
    favorites.toggle(quiz.id, 'blank');
    expect(app['activeTest']()?.questions).toEqual([questions[0]]);
    app['chooseAnswer'](questions[0], 1);
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ testId: quiz.id, score: 1, total: 1, practiceScope: 'favorites' });
    expect(app['latestFor'](quiz.id)).toBeUndefined();
    expect(app['latestFor'](quiz.id, undefined, 'favorites')?.score).toBe(1);
    expect(JSON.stringify(quiz)).toBe(original);
    app['retryTest']();
    expect(app['chooserTest']()).toBe(quiz);
    expect(app['selectedScope']()).toBe('favorites');
    expect(app['setupTest']()?.questions).toEqual([questions[2]]);
    app['selectedScope'].set('all');
    app['startChosenTest']();
    expect(app['activeTest']()).toBe(quiz);
    expect(app['activeScope']()).toBe('all');
  });

  it.each([
    { direction: 'define', mode: 'instant' }, { direction: 'define', mode: 'end' },
    { direction: 'recall', mode: 'instant' }, { direction: 'recall', mode: 'end' },
  ] as const)('practices shared terminology favorites in $direction with $mode feedback', ({ direction, mode }) => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    TestBed.inject(FavoritesService).toggle(terms.id, term.id);
    app['openTestSetup'](terms, direction, 'favorites');
    app['selectedMode'].set(mode);
    app['startChosenTest']();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(app['activeTest']()?.questions).toEqual([term]);
    expect(app['currentQuestion']()).toBe(term);
    expect(app['questionNumber'](term)).toBe('2');
    expect(root.querySelector('.question-count')?.textContent).toContain('Question 1 of 1');
    expect(root.querySelector<HTMLButtonElement>('app-favorite-button button')!.getAttribute('aria-pressed')).toBe('true');
    if (direction === 'recall') {
      expect(root.querySelector('.question-card')?.textContent).not.toContain('LAN');
      app['updateWritten'](term, textEvent('LAN'));
      if (mode === 'instant') app['checkObjective'](term);
    } else {
      app['updateWritten'](term, textEvent('A network in a small area.'));
      if (mode === 'instant') {
        app['revealWritten'](term);
        app['selfGrade'](term, true);
      }
    }
    app['nextQuestion']();
    if (direction === 'define' && mode === 'end') {
      expect(app['writtenQuestions']()).toEqual([term]);
      app['gradeReview'](true);
    }
    expect(app['result']()).toMatchObject({ score: 1, total: 1, practiceScope: 'favorites', terminologyDirection: direction });
  });

  it('lets written-review and results toggles update the same favorite list', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    app['beginTest']({ ...quiz, questions: [questions[3]] }, 'end');
    app['updateWritten'](questions[3], textEvent('My answer'));
    app['nextQuestion']();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.review-card app-favorite-button button')!.click();
    app['gradeReview'](true);
    fixture.detectChanges();
    const button = root.querySelector<HTMLButtonElement>('.review-list app-favorite-button button')!;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(TestBed.inject(FavoritesService).has(quiz.id, 'written')).toBe(false);
  });

  it('scores a favorited matching question by its pairs', () => {
    const app = TestBed.createComponent(App).componentInstance;
    TestBed.inject(FavoritesService).toggle(quiz.id, 'matching');
    app['beginTest'](quiz, 'end', 'define', 'favorites');
    app['chooseMatch'](questions[4], 0, textEvent('0'));
    app['chooseMatch'](questions[4], 1, textEvent('0'));
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ score: 1, total: 2, percentage: 50, practiceScope: 'favorites' });
  });

  it('labels favorites in history and reopens the same practice scope', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    TestBed.inject(FavoritesService).toggle(quiz.id, 'choice');
    app['beginTest'](quiz, 'end', 'define', 'favorites');
    app['chooseAnswer'](questions[0], 1);
    app['nextQuestion']();
    app['navigate']('history');
    fixture.detectChanges();
    expect(root.querySelector('.history-copy')?.textContent).toContain('Favorites only');
    root.querySelector<HTMLButtonElement>('.history-action')!.click();
    fixture.detectChanges();
    expect(app['selectedScope']()).toBe('favorites');
    expect(root.querySelector('.direction-score')?.textContent?.replace(/\s+/g, ' ')).toContain('Favorites · Last: 100%');
  });

  it('restores results settings when a changed favorites setup is cancelled', () => {
    const app = TestBed.createComponent(App).componentInstance;
    TestBed.inject(FavoritesService).toggle(terms.id, 'lan');
    app['beginTest'](terms, 'end', 'recall', 'favorites');
    app['updateWritten'](term, textEvent('LAN'));
    app['nextQuestion']();
    app['retryTest']();
    app['selectedScope'].set('all');
    app['selectedDirection'].set('define');
    app['closeTestSetup']();
    expect(app['activeScope']()).toBe('favorites');
    expect(app['selectedScope']()).toBe('favorites');
    expect(app['selectedDirection']()).toBe('recall');
    expect(app['result']()).toMatchObject({ score: 1, total: 1, practiceScope: 'favorites' });
  });
});
