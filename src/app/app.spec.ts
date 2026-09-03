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
const termQuestion: TestQuestion = { id: 'term-lan', type: 'written', prompt: 'Define LAN.', exampleAnswer: 'A local area network.' };
const terminologyTest: TestDefinition = { ...multiTest, id: 'networking-terms', category: 'terminology', title: 'Chapter 2: Terminology', questions: [termQuestion] };
const textEvent = (value: string) => ({ target: { value } }) as unknown as Event;

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

  it('keeps the two libraries separate and retains subject-first filtering', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['tests'].set([testFixture, multiTest, terminologyTest]);
    expect(app['libraryTests']().map((test) => test.id)).toEqual([testFixture.id, multiTest.id]);
    app['navigate']('terminology');
    expect(app['selectedSubject']()).toBeNull();
    expect(app['subjects']()).toMatchObject([{ name: 'Networking', tests: 1, questions: 1 }]);
    app['chooseSubject']('Networking');
    expect(app['filteredTests']()).toEqual([terminologyTest]);
    app['search'].set('unmatched');
    expect(app['filteredTests']()).toEqual([]);
    app['navigate']('library');
    expect(app['search']()).toBe('');
    expect(app['selectedSubject']()).toBeNull();
    expect(app['libraryTests']()).toHaveLength(2);
  });

  it('requires a written definition before revealing, then self-checks and saves it', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest'](terminologyTest, 'instant');
    app['updateWritten'](termQuestion, textEvent('   '));
    app['revealWritten'](termQuestion);
    app['selfGrade'](termQuestion, true);
    expect(app['answerFor'](termQuestion.id).revealed).toBeUndefined();
    expect(app['isAnswered'](termQuestion)).toBe(false);
    app['updateWritten'](termQuestion, textEvent('A network within a small geographic area.'));
    app['revealWritten'](termQuestion);
    expect(app['definitionLocked'](termQuestion)).toBe(true);
    expect(app['answerFor'](termQuestion.id).writtenComplete).toBeUndefined();
    expect(app['isAnswered'](termQuestion)).toBe(false);
    app['updateWritten'](termQuestion, textEvent('Changed after seeing example'));
    expect(app['answerFor'](termQuestion.id).text).toBe('A network within a small geographic area.');
    app['selfGrade'](termQuestion, true);
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ testId: terminologyTest.id, score: 1, total: 1 });
    expect(app['latestFor'](terminologyTest.id)?.percentage).toBe(100);
    expect(app['latestFor'](multiTest.id)).toBeUndefined();
    app['exitTest']();
    expect(app['page']()).toBe('terminology');
    expect(app['selectedSubject']()).toBe('Networking');
  });

  it('supports handwritten terminology answers in learn mode', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest'](terminologyTest, 'instant');
    app['togglePaperAnswer'](termQuestion);
    expect(app['writtenReady'](termQuestion)).toBe(true);
    app['revealWritten'](termQuestion);
    app['togglePaperAnswer'](termQuestion);
    expect(app['answerFor'](termQuestion.id).writtenComplete).toBe(true);
    app['selfGrade'](termQuestion, false);
    app['nextQuestion']();
    expect(app['result']()).toMatchObject({ score: 0, total: 1 });
  });

  it('defers terminology review until every definition is written in exam mode', () => {
    const second = { ...termQuestion, id: 'term-wan', prompt: 'Define WAN.', exampleAnswer: 'A wide area network.' };
    const app = TestBed.createComponent(App).componentInstance;
    app['beginTest']({ ...terminologyTest, questions: [termQuestion, second] }, 'end');
    app['nextQuestion']();
    expect(app['currentIndex']()).toBe(0);
    app['updateWritten'](termQuestion, textEvent('A local network.'));
    app['nextQuestion']();
    app['togglePaperAnswer'](second);
    expect(app['answerFor'](termQuestion.id).revealed).toBeUndefined();
    expect(app['answerFor'](second.id).revealed).toBeUndefined();
    app['nextQuestion']();
    expect(app['page']()).toBe('written-review');
    expect(app['result']()).toBeNull();
    app['gradeReview'](true);
    expect(app['result']()).toBeNull();
    app['gradeReview'](false);
    expect(app['result']()).toMatchObject({ score: 1, total: 2, percentage: 50 });
    app['retryTest']();
    expect(app['currentIndex']()).toBe(0);
    expect(app['answers']()).toEqual({});
    expect(app['latestFor'](terminologyTest.id)?.percentage).toBe(50);
  });
});
