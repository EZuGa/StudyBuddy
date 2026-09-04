import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { FavoritesService } from './favorites.service';
import { ProgressService } from './progress.service';
import { TestDefinition } from './models';
import { TestDataService } from './test-data.service';

const quiz: TestDefinition = { id: 'quiz-2', category: 'general', subject: 'Networking', title: 'Network hardware', chapters: ['Chapter 2'], kind: 'chapter', minutes: 5, tone: 'sky', questions: [{ id: 'q1', type: 'multiple-choice', prompt: 'Choose.', options: ['A', 'B'], correctAnswer: 0 }] };
const terms: TestDefinition = { ...quiz, id: 'terms-2', category: 'terminology', title: 'Hardware terminology', questions: [{ id: 'lan', type: 'written', term: 'LAN', prompt: 'Define LAN.', exampleAnswer: 'A network within a small area.' }] };
const midterm: TestDefinition = { ...quiz, id: 'midterm', title: 'Midterm', kind: 'midterm', chapters: ['Chapter 2', 'Chapter 10'], questions: [{ ...quiz.questions[0], id: 'midterm-q1' }] };

describe('Unified chapter library', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await TestBed.configureTestingModule({ imports: [App], providers: [{ provide: TestDataService, useValue: { loadTests: () => of([quiz, terms, midterm]) } }] }).compileComponents();
  });

  it('shows tests and terminology together with working chapter breadcrumbs', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect([...root.querySelectorAll('.nav-item')].some((button) => button.textContent?.trim() === 'Terminology')).toBe(false);
    root.querySelector<HTMLButtonElement>('.subject-card')!.click();
    fixture.detectChanges();
    const chapters = [...root.querySelectorAll<HTMLButtonElement>('.chapter-card')];
    expect(chapters.map((chapter) => chapter.querySelector('h3')?.textContent)).toEqual(['Chapter 2', 'Chapter 10']);
    expect(chapters[0].textContent).toContain('1 terminology quiz');
    chapters[0].click();
    fixture.detectChanges();
    expect([...root.querySelectorAll('.quiz-category')].map((badge) => badge.textContent)).toEqual(['Test', 'Terminology', 'Test']);
    expect(root.querySelectorAll('.test-card')).toHaveLength(3);
    const buttons = root.querySelectorAll<HTMLButtonElement>('.library-breadcrumbs button');
    buttons[1].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.chapter-card')).toHaveLength(2);
    expect(root.querySelector('.test-card')).toBeNull();
    root.querySelector<HTMLButtonElement>('.library-breadcrumbs button')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.subject-card')).not.toBeNull();
  });

  it('includes a midterm under every covered chapter without duplicate quiz objects', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['tests'].set([quiz, terms, midterm]);
    app['chooseSubject']('Networking');
    app['chooseChapter']('Chapter 10');
    expect(app['filteredTests']()).toEqual([midterm]);
    expect(app['chapterSummary'](midterm)).toBe('Chapter 2 · Chapter 10');
    app['beginTest'](midterm, 'end');
    app['exitTest']();
    expect(app['page']()).toBe('library');
    expect(app['selectedChapter']()).toBe('Chapter 10');
    app['chooseChapter']('Chapter 2');
    expect(app['filteredTests']()).toEqual([quiz, terms, midterm]);
    expect(app['tests']()).toHaveLength(3);
  });

  it('keeps terminology-only subjects visible and scopes chapter searches to the subject', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['tests'].set([quiz, terms, { ...terms, id: 'biology-terms', subject: 'Biology', chapters: ['Chapter 1'] }]);
    app['chooseSubject']('Biology');
    expect(app['chapters']()).toMatchObject([{ name: 'Chapter 1', tests: 0, terminology: 1 }]);
    app['search'].set('2');
    expect(app['filteredChapters']()).toEqual([]);
    app['chooseSubject']('Networking');
    expect(app['search']()).toBe('');
    expect(app['chapters']()).toHaveLength(1);
    app['chooseChapter']('Chapter 2');
    app['search'].set('terminology');
    expect(app['filteredTests']()).toEqual([terms]);
    app['showSubjects']();
    expect(app['selectedChapter']()).toBeNull();
  });

  it('retains existing scores and favorites for both quiz categories in the chapter', () => {
    localStorage.setItem('studydeck-favorites-v1', JSON.stringify([{ testId: terms.id, questionId: 'lan' }]));
    localStorage.setItem('studydeck-score-history-v2', JSON.stringify([{ id: 'old-score', testId: terms.id, testTitle: terms.title, subject: terms.subject, score: 1, total: 1, percentage: 100, mode: 'instant', completedAt: '2026-09-03T12:00:00Z' }]));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app['chooseSubject']('Networking');
    app['chooseChapter']('Chapter 2');
    fixture.detectChanges();
    expect(app['chapters']()[0].practiced).toBe(1);
    expect(TestBed.inject(ProgressService).latestFor(terms.id)?.percentage).toBe(100);
    expect(TestBed.inject(FavoritesService).questionsFor(terms)).toEqual(terms.questions);
    const cards = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.test-card')];
    const termCard = cards.find((card) => card.textContent?.includes(terms.title))!;
    expect(termCard.textContent).toContain('Last 100%');
    termCard.querySelector<HTMLButtonElement>('.favorites-practice')!.click();
    app['selectedDirection'].set('recall');
    app['startChosenTest']();
    expect(app['activeScope']()).toBe('favorites');
    expect(app['reverseTerminology']()).toBe(true);
    app['exitTest']();
    expect(app['selectedChapter']()).toBe('Chapter 2');
  });
});
