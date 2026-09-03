import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { TestDefinition, TestQuestion } from './models';
import { TestDataService } from './test-data.service';

const testFixture: TestDefinition = {
  id: 'biology-cells', subject: 'Biology', title: 'Cells', chapters: ['Chapter 1'], kind: 'chapter', minutes: 5, tone: 'sage',
  questions: [{ id: 'q1', type: 'multiple-choice', prompt: 'Which organelle makes ATP?', options: ['Nucleus', 'Mitochondrion'], correctAnswer: 1 }],
};

const multiQuestion: TestQuestion = { id: 'q71', type: 'multiple-select', prompt: 'Choose all correct options.', options: ['A', 'B', 'C'], correctAnswers: [0, 2], explanation: 'A and C are correct.' };
const multiTest: TestDefinition = { ...testFixture, id: 'networking-chapter-2', subject: 'Networking', title: 'Chapter 2', chapters: ['Chapter 2'], questions: [multiQuestion] };

describe('App', () => {
  beforeEach(async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: TestDataService, useValue: { loadTests: () => of([testFixture]) } }],
    }).compileComponents();
  });

  it('creates the StudyDeck app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders subjects first and reveals tests after a subject is selected', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Ready to make it stick?');
    expect(compiled.textContent).toContain('Your subjects');
    expect(compiled.textContent).toContain('Biology');
    expect(compiled.textContent).not.toContain('Which organelle makes ATP?');

    const biology = [...compiled.querySelectorAll<HTMLButtonElement>('.subject-card')]
      .find((button) => button.textContent?.includes('Biology'));
    biology?.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Biology tests');
    expect(compiled.textContent).toContain('Cells');
  });

  it('requires explicit checking in learn mode and locks multi-select answers afterward', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest'](multiTest, 'instant');
    app['checkObjective'](multiQuestion);
    expect(app['isAnswered'](multiQuestion)).toBe(false);
    app['toggleChoice'](multiQuestion, 0);
    app['toggleChoice'](multiQuestion, 2);
    expect(app['isAnswered'](multiQuestion)).toBe(false);
    app['checkObjective'](multiQuestion);
    expect(app['isAnswered'](multiQuestion)).toBe(true);
    expect(app['isCorrect'](multiQuestion)).toBe(true);
    app['toggleChoice'](multiQuestion, 1);
    expect(app['answerFor']('q71').choices).toEqual([0, 2]);
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ score: 1, total: 1, percentage: 100 });
  });

  it.each([
    { choices: [], correct: false },
    { choices: [0], correct: false },
    { choices: [1], correct: false },
    { choices: [0, 1, 2], correct: false },
    { choices: [2, 0], correct: true },
  ])('grades the complete selection exactly: $choices', ({ choices, correct }) => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest'](multiTest, 'end');
    choices.forEach((choice) => app['toggleChoice'](multiQuestion, choice));
    expect(app['isCorrect'](multiQuestion)).toBe(correct);
  });

  it('allows changes in exam mode and preserves earlier scores when saving a new attempt', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest'](testFixture, 'instant');
    app['chooseAnswer'](testFixture.questions[0], 1);
    app['nextQuestion']();
    app['beginTest'](multiTest, 'end');
    app['toggleChoice'](multiQuestion, 0);
    app['toggleChoice'](multiQuestion, 1);
    app['toggleChoice'](multiQuestion, 1);
    app['toggleChoice'](multiQuestion, 2);
    expect(app['isAnswered'](multiQuestion)).toBe(true);
    expect(app['answerFor']('q71').checked).toBe(false);
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ score: 1, total: 1, mode: 'end' });
    const history = JSON.parse(localStorage.getItem('studydeck-score-history-v2')!);
    expect(history).toHaveLength(2);
    expect(history.map((attempt: { testId: string }) => attempt.testId)).toEqual([multiTest.id, testFixture.id]);
    app['retryTest']();
    expect(app['answerFor']('q71')).toEqual({});
    app['toggleChoice'](multiQuestion, 1);
    app['nextQuestion']();
    expect(app['latestFor'](multiTest.id)?.score).toBe(0);
    expect(app['bestFor'](multiTest.id)?.score).toBe(1);
  });

  it('includes true/false corrections in written review before saving the final score', () => {
    const written: TestQuestion = { id: 'q86', type: 'written', prompt: 'True or false? Correct the false statement.', exampleAnswer: 'False. A hub repeats signals.' };
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest']({ ...multiTest, questions: [multiQuestion, written] }, 'end');
    app['toggleChoice'](multiQuestion, 0);
    app['toggleChoice'](multiQuestion, 2);
    app['nextQuestion']();
    app['togglePaperAnswer'](written);
    app['nextQuestion']();
    expect(app['page']()).toBe('written-review');
    expect(app['result']()).toBeNull();
    app['gradeReview'](false);
    expect(app['result']()).toMatchObject({ score: 1, total: 2, percentage: 50 });
  });
});
