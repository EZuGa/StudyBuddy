import { Injectable, signal } from '@angular/core';
import { TerminologyDirection, TestAttempt } from './models';

const STORAGE_KEY = 'studydeck-score-history-v2';
const LEGACY_STORAGE_KEY = 'studydeck-score-history-v1';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  readonly attempts = signal<TestAttempt[]>(this.read());

  constructor() {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Ignore unavailable storage. */ }
  }

  addAttempt(attempt: TestAttempt): void {
    const next = [attempt, ...this.attempts()];
    this.attempts.set(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* The app still works when storage is unavailable. */ }
  }

  latestFor(testId: string, direction?: TerminologyDirection): TestAttempt | undefined {
    return this.attempts().find((attempt) => this.matches(attempt, testId, direction));
  }

  bestFor(testId: string, direction?: TerminologyDirection): TestAttempt | undefined {
    return this.attempts().filter((attempt) => this.matches(attempt, testId, direction)).sort((a, b) => b.percentage - a.percentage)[0];
  }

  private matches(attempt: TestAttempt, testId: string, direction?: TerminologyDirection): boolean {
    return attempt.testId === testId && (!direction || (attempt.terminologyDirection ?? 'define') === direction);
  }

  private read(): TestAttempt[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed as TestAttempt[] : [];
    } catch { return []; }
  }
}
