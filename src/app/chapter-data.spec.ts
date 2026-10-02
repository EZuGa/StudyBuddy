import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import library from '../../public/tests/library.json';
import { App } from './app';
import { FavoritesService } from './favorites.service';

describe('Project chapter data integration', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function loadApp() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/tests/library.json').flush(library);
    fixture.detectChanges();
    return fixture;
  }

  it('renders all project chapters, each containing quiz and terminology from its own object', () => {
    expect(library.map((chapter) => chapter.id)).toContain('networking-chapter-3');
    expect(library.slice(0, 2).map((chapter) => [chapter.quiz.questions.length, chapter.terminology.questions.length])).toEqual([[36, 10], [100, 27]]);
    const fixture = loadApp();
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.subject-card')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.chapter-card')).toHaveLength(library.length);
    for (const chapter of library) {
      app['chooseChapter'](chapter.title);
      fixture.detectChanges();
      expect(app['filteredTests']().map((test) => test.id)).toEqual([chapter.quiz.id, chapter.terminology.id]);
      expect(root.querySelectorAll('.test-card')).toHaveLength(2);
    }
    const questionCount = library.reduce((count, chapter) => count + chapter.quiz.questions.length + chapter.terminology.questions.length, 0);
    expect(app['tests']().reduce((count, quiz) => count + quiz.questions.length, 0)).toBe(questionCount);
  });

  it.each(library)('retains scores, favorites, and both term directions for $title', (chapter) => {
    localStorage.setItem('studydeck-favorites-v1', JSON.stringify([
      { testId: chapter.quiz.id, questionId: chapter.quiz.questions[0].id },
      { testId: chapter.terminology.id, questionId: chapter.terminology.questions[0].id },
    ]));
    localStorage.setItem('studydeck-score-history-v2', JSON.stringify([
      { id: 'saved-score', testId: chapter.quiz.id, testTitle: chapter.quiz.title, subject: chapter.subject, score: 20, total: 40, percentage: 50, mode: 'end', completedAt: '2026-09-03T12:00:00Z' },
    ]));
    const app = loadApp().componentInstance;
    const quiz = app['tests']().find((test) => test.id === chapter.quiz.id)!;
    const terms = app['tests']().find((test) => test.id === chapter.terminology.id)!;
    expect(app['latestFor'](quiz.id)?.percentage).toBe(50);
    const favorites = TestBed.inject(FavoritesService);
    expect(favorites.questionsFor(quiz).map((question) => question.id)).toEqual([chapter.quiz.questions[0].id]);
    expect(favorites.questionsFor(terms).map((question) => question.id)).toEqual([chapter.terminology.questions[0].id]);
    for (const direction of ['define', 'recall'] as const) {
      for (const mode of ['instant', 'end'] as const) {
        app['beginTest'](terms, mode, direction, 'favorites');
        expect(app['activeTest']()?.questions).toHaveLength(1);
        expect(app['questionPrompt'](terms.questions[0])).toBe(direction === 'define' ? terms.questions[0].prompt : chapter.terminology.questions[0].definition);
        app['exitTest']();
        expect(app['selectedChapter']()).toBe(chapter.title);
      }
    }
  });

  it('imports an activity into its existing chapter without removing the sibling activity', async () => {
    const app = loadApp().componentInstance;
    const { quiz, ...chapter } = structuredClone(library[0]);
    chapter.terminology.title = 'Updated terminology';
    const input = { files: [{ text: async () => JSON.stringify([chapter]) }], value: 'chapter.json' };
    await app['importFile']({ target: input } as unknown as Event);
    expect(app['importStatus']()?.tone).toBe('success');
    expect(app['tests']()).toHaveLength(library.length * 2);
    expect(app['tests']().find((test) => test.id === quiz.id)?.title).toBe(quiz.title);
    expect(app['tests']().find((test) => test.id === chapter.terminology.id)?.title).toBe('Updated terminology');
    app['chooseSubject'](chapter.subject);
    expect(app['chapters']()).toHaveLength(library.length);
    expect(input.value).toBe('');
  });
});
