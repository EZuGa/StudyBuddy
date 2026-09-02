import { Injectable, signal } from '@angular/core';
import { TestAttempt } from './models';

const STORAGE_KEY = 'studydeck-score-history-v1';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  readonly attempts = signal<TestAttempt[]>(this.read());

  addAttempt(attempt: TestAttempt): void {
    const next = [attempt, ...this.attempts()];
    this.attempts.set(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* The app still works when storage is unavailable. */ }
  }

  latestFor(testId: string): TestAttempt | undefined {
    return this.attempts().find((attempt) => attempt.testId === testId);
  }

  bestFor(testId: string): TestAttempt | undefined {
    return this.attempts().filter((attempt) => attempt.testId === testId).sort((a, b) => b.percentage - a.percentage)[0];
  }

  private read(): TestAttempt[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed as TestAttempt[] : [];
    } catch { return []; }
  }
}
