import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AppPage, FeedbackMode, PracticeScope, QuestionAnswer, TerminologyDirection, TestAttempt, TestDefinition, TestQuestion } from './models';
import { FavoriteButton } from './favorite-button';
import { FavoritesService } from './favorites.service';
import { ProgressService } from './progress.service';
import { TestDataService } from './test-data.service';

@Component({
  selector: 'app-root',
  imports: [FavoriteButton],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly dataService = inject(TestDataService);
  private readonly progressService = inject(ProgressService);
  protected readonly favorites = inject(FavoritesService);

  protected readonly tests = signal<TestDefinition[]>([]);
  protected readonly attempts = this.progressService.attempts;
  protected readonly page = signal<AppPage>('library');
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly search = signal('');
  protected readonly selectedSubject = signal<string | null>(null);
  protected readonly selectedChapter = signal<string | null>(null);
  protected readonly listView = signal(false);
  protected readonly chooserTest = signal<TestDefinition | null>(null);
  protected readonly selectedMode = signal<FeedbackMode>('instant');
  protected readonly selectedDirection = signal<TerminologyDirection>('define');
  protected readonly selectedScope = signal<PracticeScope>('all');
  protected readonly activeScope = signal<PracticeScope>('all');
  protected readonly activeSourceTest = signal<TestDefinition | null>(null);
  protected readonly activeTest = signal<TestDefinition | null>(null);
  protected readonly currentIndex = signal(0);
  protected readonly answers = signal<Record<string, QuestionAnswer>>({});
  protected readonly reviewIndex = signal(0);
  protected readonly result = signal<TestAttempt | null>(null);
  protected readonly importOpen = signal(false);
  protected readonly importStatus = signal<{ tone: 'success' | 'error'; text: string } | null>(null);
  protected readonly importedIds = signal<Set<string>>(new Set());
  protected readonly mobileMenuOpen = signal(false);
  private readonly webMcpLifecycle = new AbortController();

  protected readonly libraryTests = this.tests;

  protected readonly subjects = computed(() => {
    const grouped = new Map<string, TestDefinition[]>();
    for (const test of this.libraryTests()) grouped.set(test.subject, [...(grouped.get(test.subject) ?? []), test]);
    return [...grouped.entries()].map(([name, tests]) => ({
      name,
      tone: tests[0].tone,
      tests: tests.length,
      questions: tests.reduce((total, test) => total + this.questionUnitCount(test), 0),
      chapters: new Set(tests.flatMap((test) => test.chapters)).size,
      practiced: tests.filter((test) => this.latestFor(test.id)).length,
    }));
  });
  protected readonly filteredSubjects = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.subjects().filter((subject) => !query || subject.name.toLowerCase().includes(query));
  });
  protected readonly chapters = computed(() => {
    const grouped = new Map<string, TestDefinition[]>();
    for (const test of this.tests().filter((test) => test.subject === this.selectedSubject())) {
      for (const chapter of new Set(test.chapters)) grouped.set(chapter, [...(grouped.get(chapter) ?? []), test]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([name, quizzes]) => ({
      name, tone: quizzes[0].tone,
      tests: quizzes.filter((quiz) => quiz.category !== 'terminology').length,
      terminology: quizzes.filter((quiz) => quiz.category === 'terminology').length,
      total: quizzes.length,
      practiced: quizzes.filter((quiz) => this.latestFor(quiz.id)).length,
    }));
  });
  protected readonly filteredChapters = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.chapters().filter((chapter) => !query || chapter.name.toLowerCase().includes(query));
  });
  protected readonly filteredTests = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.libraryTests().filter((test) => {
      const matchesSubject = test.subject === this.selectedSubject() && test.chapters.includes(this.selectedChapter() ?? '');
      const searchable = `${test.title} ${test.category === 'terminology' ? 'terminology' : 'test'} ${test.subject} ${test.chapters.join(' ')}`.toLowerCase();
      return matchesSubject && (!query || searchable.includes(query));
    });
  });
  protected readonly currentQuestion = computed(() => this.activeTest()?.questions[this.currentIndex()] ?? null);
  protected readonly setupTest = computed(() => {
    const test = this.chooserTest();
    return test ? this.scopedTest(test, this.selectedScope()) : null;
  });
  protected readonly reverseTerminology = computed(() => this.activeTest()?.category === 'terminology' && this.selectedDirection() === 'recall');
  protected readonly writtenQuestions = computed(() => this.reverseTerminology() ? [] : this.activeTest()?.questions.filter((question) => question.type === 'written') ?? []);
  protected readonly reviewQuestion = computed(() => this.writtenQuestions()[this.reviewIndex()] ?? null);
  protected readonly averageScore = computed(() => {
    const history = this.attempts();
    return history.length ? Math.round(history.reduce((sum, attempt) => sum + attempt.percentage, 0) / history.length) : null;
  });
  protected readonly streak = computed(() => this.calculateStreak(this.attempts()));

  ngOnInit(): void {
    this.dataService.loadTests().subscribe({
      next: (tests) => { this.tests.set(tests); this.loading.set(false); },
      error: () => { this.loadError.set('The test library could not be loaded. Check public/tests/library.json.'); this.loading.set(false); },
    });
    this.registerWebMcpTools();
  }

  ngOnDestroy(): void { this.webMcpLifecycle.abort(); }

  protected navigate(page: 'library' | 'history'): void {
    this.page.set(page);
    if (page !== 'history') { this.selectedSubject.set(null); this.selectedChapter.set(null); this.search.set(''); }
    this.mobileMenuOpen.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected chooseSubject(subject: string): void {
    this.selectedSubject.set(subject);
    this.selectedChapter.set(null);
    this.search.set('');
    document.getElementById('library')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  protected showSubjects(): void {
    this.selectedSubject.set(null);
    this.selectedChapter.set(null);
    this.search.set('');
    document.getElementById('library')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  protected chooseChapter(chapter: string): void {
    this.selectedChapter.set(chapter);
    this.search.set('');
    document.getElementById('library')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  protected openTestSetup(test: TestDefinition, direction: TerminologyDirection = 'define', scope: PracticeScope = 'all'): void {
    this.chooserTest.set(test);
    this.selectedScope.set(scope);
    this.selectedMode.set('instant');
    this.selectedDirection.set(direction === 'recall' && this.supportsReverse(test) ? 'recall' : 'define');
  }

  protected closeTestSetup(): void {
    this.chooserTest.set(null);
    const result = this.result();
    if (this.page() === 'results' && result) {
      this.selectedMode.set(result.mode);
      this.selectedDirection.set(result.terminologyDirection ?? 'define');
      this.selectedScope.set(this.activeScope());
    }
  }

  protected startChosenTest(): void {
    const test = this.chooserTest();
    if (!test || !this.setupTest()?.questions.length) return;
    this.chooserTest.set(null);
    this.beginTest(test, this.selectedMode(), this.selectedDirection(), this.selectedScope());
  }

  private beginTest(test: TestDefinition, mode: FeedbackMode, direction: TerminologyDirection = 'define', scope: PracticeScope = 'all'): void {
    if (direction === 'recall' && !this.supportsReverse(test)) throw new Error('Reverse practice requires an explicit term and definition for every question.');
    const scoped = this.scopedTest(test, scope);
    if (!scoped.questions.length) throw new Error('Add at least one favorite before starting favorites practice.');
    this.activeSourceTest.set(test);
    this.activeScope.set(scope);
    this.activeTest.set(scoped);
    this.selectedDirection.set(test.category === 'terminology' ? direction : 'define');
    if (this.selectedSubject() !== test.subject || !test.chapters.includes(this.selectedChapter() ?? '')) this.selectedChapter.set(test.chapters[0]);
    this.selectedSubject.set(test.subject);
    this.search.set('');
    this.selectedMode.set(mode);
    this.answers.set({});
    this.currentIndex.set(0);
    this.reviewIndex.set(0);
    this.result.set(null);
    this.page.set('taking');
    window.scrollTo({ top: 0 });
  }

  protected exitTest(): void {
    this.activeTest.set(null);
    this.activeSourceTest.set(null);
    this.answers.set({});
    this.page.set('library');
  }

  protected answerFor(questionId: string): QuestionAnswer { return this.answers()[questionId] ?? {}; }

  protected chooseAnswer(question: TestQuestion, optionIndex: number): void {
    if (this.selectedMode() === 'instant' && this.answerFor(question.id).choice !== undefined) return;
    this.setAnswer(question.id, { ...this.answerFor(question.id), choice: optionIndex });
  }

  protected isAnswered(question: TestQuestion): boolean {
    const answer = this.answerFor(question.id);
    if (this.reverseTerminology()) return Boolean(answer.text?.trim()) && (this.selectedMode() === 'end' || answer.checked === true);
    if (question.type === 'multiple-choice') return answer.choice !== undefined;
    if (question.type === 'multiple-select') return Boolean(answer.choices?.length) && (this.selectedMode() === 'end' || answer.checked === true);
    if (question.type === 'fill-blank') return Boolean(answer.text?.trim()) && (this.selectedMode() === 'end' || answer.checked === true);
    if (question.type === 'matching') return this.matchingReady(question) && (this.selectedMode() === 'end' || answer.checked === true);
    if (this.selectedMode() === 'instant') return answer.selfGrade !== undefined;
    return Boolean(answer.writtenComplete || answer.text?.trim());
  }

  protected isCorrect(question: TestQuestion): boolean {
    const answer = this.answerFor(question.id);
    if (this.reverseTerminology()) return Boolean(answer.text?.trim() && [question.term, ...(question.acceptedTerms ?? [])].some((term) => term && this.normalizeTerm(term) === this.normalizeTerm(answer.text!)));
    if (question.type === 'multiple-choice') return answer.choice === question.correctAnswer;
    if (question.type === 'multiple-select') {
      const choices = new Set(answer.choices ?? []);
      return Boolean(question.correctAnswers?.length && choices.size === question.correctAnswers.length && question.correctAnswers.every((index) => choices.has(index)));
    }
    if (question.type === 'fill-blank') return Boolean(answer.text && question.acceptedAnswers?.some((accepted) => this.normalizeAnswer(accepted) === this.normalizeAnswer(answer.text!)));
    if (question.type === 'matching') return Boolean(question.pairs?.every((_, index) => answer.matches?.[index] === index));
    return answer.selfGrade === true;
  }

  protected revealWritten(question: TestQuestion): void {
    if (this.reverseTerminology()) return;
    if (this.activeTest()?.category === 'terminology' && !this.writtenReady(question)) return;
    const current = this.answerFor(question.id);
    this.setAnswer(question.id, { ...current, revealed: true, writtenComplete: this.activeTest()?.category === 'terminology' ? current.writtenComplete : true });
  }

  protected writtenReady(question: TestQuestion): boolean {
    const answer = this.answerFor(question.id);
    return Boolean(answer.text?.trim() || answer.writtenComplete);
  }

  protected definitionLocked(question: TestQuestion): boolean {
    const answer = this.answerFor(question.id);
    return this.activeTest()?.category === 'terminology' && this.selectedMode() === 'instant' && (answer.revealed === true || answer.checked === true);
  }

  protected updateWritten(question: TestQuestion, event: Event): void {
    if (this.definitionLocked(question)) return;
    const text = (event.target as HTMLTextAreaElement).value;
    this.setAnswer(question.id, { ...this.answerFor(question.id), text });
  }

  protected chooseMatch(question: TestQuestion, termIndex: number, event: Event): void {
    if (this.selectedMode() === 'instant' && this.answerFor(question.id).checked) return;
    const selected = Number((event.target as HTMLSelectElement).value);
    const current = this.answerFor(question.id);
    this.setAnswer(question.id, { ...current, matches: { ...current.matches, [termIndex]: selected }, checked: false });
  }

  protected matchingDefinitions(question: TestQuestion): Array<{ definition: string; originalIndex: number }> {
    return (question.pairs ?? []).map((pair, originalIndex) => ({ definition: pair.definition, originalIndex })).reverse();
  }

  protected matchingReady(question: TestQuestion): boolean {
    const matches = this.answerFor(question.id).matches;
    return Boolean(question.pairs?.length && question.pairs.every((_, index) => matches?.[index] !== undefined && matches[index] >= 0));
  }

  protected matchRowCorrect(question: TestQuestion, termIndex: number): boolean {
    return this.answerFor(question.id).matches?.[termIndex] === termIndex;
  }

  protected selectedDefinition(question: TestQuestion, termIndex: number): string {
    const selected = this.answerFor(question.id).matches?.[termIndex];
    return selected === undefined || selected < 0 ? 'No match' : question.pairs?.[selected]?.definition ?? 'No match';
  }

  protected checkObjective(question: TestQuestion): void {
    if (this.reverseTerminology() && !this.answerFor(question.id).text?.trim()) return;
    if (question.type === 'multiple-select' && !this.answerFor(question.id).choices?.length) return;
    if (question.type === 'fill-blank' && !this.answerFor(question.id).text?.trim()) return;
    if (question.type === 'matching' && !this.matchingReady(question)) return;
    this.setAnswer(question.id, { ...this.answerFor(question.id), checked: true });
  }

  protected togglePaperAnswer(question: TestQuestion): void {
    if (this.reverseTerminology()) return;
    if (this.definitionLocked(question)) return;
    const current = this.answerFor(question.id);
    this.setAnswer(question.id, { ...current, writtenComplete: !current.writtenComplete });
  }

  protected toggleChoice(question: TestQuestion, optionIndex: number): void {
    const current = this.answerFor(question.id);
    if (this.selectedMode() === 'instant' && current.checked) return;
    const choices = new Set(current.choices ?? []);
    if (choices.has(optionIndex)) choices.delete(optionIndex);
    else choices.add(optionIndex);
    this.setAnswer(question.id, { ...current, choices: [...choices].sort((a, b) => a - b), checked: false });
  }

  protected choiceSummary(question: TestQuestion, indices: number[] | undefined): string {
    return indices?.length ? indices.map((index) => `${this.optionLetter(index)}. ${question.options?.[index]}`).join('; ') : 'No answer';
  }

  protected selfGrade(question: TestQuestion, correct: boolean): void {
    if (this.reverseTerminology()) return;
    if (this.activeTest()?.category === 'terminology' && this.selectedMode() === 'instant' && !this.answerFor(question.id).revealed) return;
    this.setAnswer(question.id, { ...this.answerFor(question.id), selfGrade: correct, writtenComplete: true });
  }

  protected previousQuestion(): void {
    if (this.currentIndex() > 0) this.currentIndex.update((index) => index - 1);
  }

  protected nextQuestion(): void {
    const test = this.activeTest();
    const question = this.currentQuestion();
    if (!test || !question || !this.isAnswered(question)) return;
    if (this.currentIndex() < test.questions.length - 1) {
      this.currentIndex.update((index) => index + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.finishTest();
  }

  private finishTest(): void {
    if (this.selectedMode() === 'end' && this.writtenQuestions().length) {
      this.reviewIndex.set(0);
      this.page.set('written-review');
      window.scrollTo({ top: 0 });
      return;
    }
    this.completeTest();
  }

  protected gradeReview(correct: boolean): void {
    const question = this.reviewQuestion();
    if (!question) return;
    this.selfGrade(question, correct);
    if (this.reviewIndex() < this.writtenQuestions().length - 1) {
      this.reviewIndex.update((index) => index + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.completeTest();
    }
  }

  private completeTest(): void {
    const test = this.activeTest();
    if (!test) return;
    const score = test.questions.reduce((total, question) => total + this.correctUnits(question), 0);
    const total = this.questionUnitCount(test);
    const attempt: TestAttempt = {
      id: `${test.id}-${Date.now()}`,
      testId: test.id,
      testTitle: test.title,
      subject: test.subject,
      score,
      total,
      percentage: Math.round((score / total) * 100),
      mode: this.selectedMode(),
      ...(test.category === 'terminology' ? { terminologyDirection: this.selectedDirection() } : {}),
      ...(this.activeScope() === 'favorites' ? { practiceScope: 'favorites' as const } : {}),
      completedAt: new Date().toISOString(),
    };
    this.progressService.addAttempt(attempt);
    this.result.set(attempt);
    this.page.set('results');
    window.scrollTo({ top: 0 });
  }

  protected retryTest(): void {
    const test = this.activeSourceTest();
    if (!test) return;
    if (test.category === 'terminology' || this.activeScope() === 'favorites') {
      const mode = this.selectedMode();
      this.openTestSetup(test, this.selectedDirection(), this.activeScope());
      this.selectedMode.set(mode);
    } else {
      this.beginTest(test, this.selectedMode());
    }
  }

  protected latestFor(testId: string, direction?: TerminologyDirection, scope: PracticeScope = 'all'): TestAttempt | undefined { return this.progressService.latestFor(testId, direction, scope); }
  protected bestFor(testId: string, direction?: TerminologyDirection, scope: PracticeScope = 'all'): TestAttempt | undefined { return this.progressService.bestFor(testId, direction, scope); }
  protected favoriteCount(test: TestDefinition): number { return this.favorites.questionsFor(test).length; }

  private scopedTest(test: TestDefinition, scope: PracticeScope): TestDefinition {
    if (scope === 'all') return test;
    const questions = this.favorites.questionsFor(test);
    return { ...test, questions, minutes: questions.length ? Math.max(1, Math.ceil(test.minutes * questions.length / test.questions.length)) : 0 };
  }
  protected isImported(testId: string): boolean { return this.importedIds().has(testId); }

  protected openImport(): void {
    this.importStatus.set(null);
    this.importOpen.set(true);
    this.mobileMenuOpen.set(false);
  }

  protected closeImport(): void { this.importOpen.set(false); }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = this.dataService.parseTests(JSON.parse(await file.text()));
      const byId = new Map(this.tests().map((test) => [test.id, test]));
      imported.forEach((test) => byId.set(test.id, test));
      this.tests.set([...byId.values()]);
      this.importedIds.update((ids) => new Set([...ids, ...imported.map((test) => test.id)]));
      this.importStatus.set({ tone: 'success', text: `${imported.length} ${imported.length === 1 ? 'test' : 'tests'} added for this session.` });
    } catch (error) {
      this.importStatus.set({ tone: 'error', text: error instanceof Error ? error.message : 'That file could not be imported.' });
    } finally { input.value = ''; }
  }

  protected downloadTemplate(): void {
    const example = [{
      id: 'my-test', category: 'general', subject: 'My subject', title: 'My chapter test', chapters: ['Chapter 1'], kind: 'chapter', minutes: 10, tone: 'coral',
      questions: [
        { id: 'q1', type: 'multiple-choice', prompt: 'Your question?', options: ['Option A', 'Option B'], correctAnswer: 0, explanation: 'Why this answer is correct.' },
        { id: 'q2', type: 'written', prompt: 'Write your response on paper.', exampleAnswer: 'A strong example response.', explanation: 'What to include.' },
        { id: 'q3', type: 'fill-blank', prompt: 'The answer is _____.', acceptedAnswers: ['example answer'], explanation: 'Why this answer fits.' },
        { id: 'q4', type: 'matching', prompt: 'Match each term with its definition.', pairs: [{ term: 'Term one', definition: 'Definition one' }, { term: 'Term two', definition: 'Definition two' }], explanation: 'Why these pairs belong together.' },
        { id: 'q5', type: 'multiple-select', prompt: 'Select all correct statements.', options: ['Correct statement', 'Another correct statement', 'Incorrect statement'], correctAnswers: [0, 1], explanation: 'Select every correct option and no incorrect options.' },
      ],
    }];
    const template = [...example, {
      id: 'my-terminology-quiz', category: 'terminology', subject: 'My subject', title: 'Chapter 1: Terminology', chapters: ['Chapter 1'], kind: 'chapter', minutes: 5, tone: 'sage',
      questions: [{ id: 'term-1', type: 'written', term: 'LAN', definition: 'A network covering a small geographic area, such as a building.', acceptedTerms: ['Local area network'] }],
    }];
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'studydeck-library-template.json'; anchor.click();
    URL.revokeObjectURL(url);
  }

  protected chapterSummary(test: TestDefinition): string {
    return test.chapters.join(' · ');
  }

  protected subjectSymbol(subject: string): string {
    const normalized = subject.toLowerCase();
    if (normalized.includes('bio')) return '⌁';
    if (normalized.includes('chem')) return '⚗';
    if (normalized.includes('history')) return '◫';
    if (normalized.includes('math')) return '∑';
    return '✦';
  }

  protected questionNumber(question: TestQuestion): string { return question.number ?? String(((this.activeSourceTest() ?? this.activeTest())?.questions.indexOf(question) ?? 0) + 1); }
  protected questionUnitCount(test: TestDefinition): number { return test.questions.reduce((total, question) => total + (question.type === 'matching' ? question.pairs?.length ?? 1 : 1), 0); }
  protected progressPercent(): number { return ((this.currentIndex() + 1) / (this.activeTest()?.questions.length || 1)) * 100; }
  protected optionLetter(index: number): string { return String.fromCharCode(65 + index); }
  protected questionTypeLabel(question: TestQuestion): string {
    if (this.reverseTerminology()) return 'Write the term';
    return ({ 'multiple-choice': 'Choose one answer', 'multiple-select': 'Choose all correct answers', written: 'Written response', matching: 'Match the pairs', 'fill-blank': 'Fill in the blank' })[question.type];
  }
  protected questionTypeSymbol(question: TestQuestion): string {
    return ({ 'multiple-choice': '✓', 'multiple-select': '☑', written: '✎', matching: '↔', 'fill-blank': '＿' })[question.type];
  }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)); }
  protected resultMessage(percentage: number): string { return percentage >= 90 ? 'Beautiful work — you’ve got this.' : percentage >= 70 ? 'Good progress. One more pass will make it stick.' : 'A solid first step. Review the notes and try again.'; }

  private setAnswer(questionId: string, answer: QuestionAnswer): void { this.answers.update((answers) => ({ ...answers, [questionId]: answer })); }

  private normalizeAnswer(value: string): string {
    return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  }

  private normalizeTerm(value: string): string {
    return this.normalizeAnswer(value.replace(/[-‐‑–—]/g, ' '));
  }

  protected supportsReverse(test: TestDefinition): boolean {
    return test.category === 'terminology' && test.questions.length > 0 && test.questions.every((question) => question.type === 'written' && Boolean(question.term?.trim()) && Boolean(question.exampleAnswer?.trim()));
  }

  protected questionPrompt(question: TestQuestion): string {
    return this.reverseTerminology() ? question.exampleAnswer ?? '' : question.prompt;
  }

  protected directionLabel(direction: TerminologyDirection): string {
    return direction === 'recall' ? 'Inverted (definition → term)' : 'Standard (term → definition)';
  }

  protected attemptDirectionLabel(attempt: TestAttempt): string {
    return attempt.terminologyDirection || this.tests().some((test) => test.id === attempt.testId && test.category === 'terminology') ? this.directionLabel(attempt.terminologyDirection ?? 'define') : '';
  }

  protected setupModeDescription(test: TestDefinition, mode: FeedbackMode): string {
    if (test.category !== 'terminology') return mode === 'instant' ? 'See the right answer and a quick explanation after each question.' : 'Work through the full test before any answers are revealed.';
    if (this.selectedDirection() === 'recall') return mode === 'instant' ? 'Type the term, then check it immediately. Answers are graded automatically.' : 'Type every term first. Reveal the correct terms and your automatic score at the end.';
    return mode === 'instant' ? 'Write a definition, compare it with the example, and self-check each term.' : 'Write every definition first, then compare and self-check them at the end.';
  }

  private correctUnits(question: TestQuestion): number {
    if (question.type === 'matching') return question.pairs?.filter((_, index) => this.matchRowCorrect(question, index)).length ?? 0;
    return this.isCorrect(question) ? 1 : 0;
  }

  private calculateStreak(attempts: TestAttempt[]): number {
    if (!attempts.length) return 0;
    const dates = new Set(attempts.map((attempt) => new Date(attempt.completedAt).toLocaleDateString('en-CA')));
    const cursor = new Date();
    if (!dates.has(cursor.toLocaleDateString('en-CA'))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (dates.has(cursor.toLocaleDateString('en-CA'))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }

  private registerWebMcpTools(): void {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const options = { signal: this.webMcpLifecycle.signal };
    const reportError = (error: unknown) => console.warn('StudyDeck WebMCP registration failed', error);
    try {
      void Promise.resolve(context.registerTool({
        name: 'list_studydeck_tests',
        title: 'List StudyDeck tests',
        description: 'List the tests currently available in the StudyDeck library, including subject, chapters, and question count.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({ tests: this.tests().map((test) => ({ id: test.id, category: test.category ?? 'general', title: test.title, subject: test.subject, chapters: test.chapters, questions: this.questionUnitCount(test) })) }),
      }, options)).catch(reportError);
      void Promise.resolve(context.registerTool({
        name: 'start_studydeck_test',
        title: 'Start a StudyDeck test',
        description: 'Open a test with instant or end feedback. For terminology, optionally choose define (term to definition) or recall (definition to term).',
        inputSchema: {
          type: 'object',
          properties: { testId: { type: 'string' }, mode: { type: 'string', enum: ['instant', 'end'] }, direction: { type: 'string', enum: ['define', 'recall'] } },
          required: ['testId', 'mode'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          if (!input || typeof input !== 'object') throw new Error('Input must include testId and mode.');
          const values = input as Record<string, unknown>;
          if (values['mode'] !== 'instant' && values['mode'] !== 'end') throw new Error('Mode must be instant or end.');
          if (values['direction'] !== undefined && values['direction'] !== 'define' && values['direction'] !== 'recall') throw new Error('Direction must be define or recall.');
          const test = this.tests().find((item) => item.id === values['testId']);
          if (!test) throw new Error(`No test found with id “${String(values['testId'])}”.`);
          const direction = values['direction'] === 'recall' ? 'recall' : 'define';
          this.beginTest(test, values['mode'], direction);
          return { status: 'started', testId: test.id, title: test.title, mode: values['mode'], ...(test.category === 'terminology' ? { direction } : {}) };
        },
      }, options)).catch(reportError);
    } catch (error) { reportError(error); }
  }
}
