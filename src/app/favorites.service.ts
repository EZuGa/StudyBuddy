import { Injectable, signal } from '@angular/core';
import { TestDefinition, TestQuestion } from './models';

interface FavoriteReference { testId: string; questionId: string; }
const STORAGE_KEY = 'studydeck-favorites-v1';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly storageNotice = signal('');
  private readonly entries = signal<FavoriteReference[]>(this.read());

  has(testId: string, questionId: string): boolean {
    return this.entries().some((entry) => entry.testId === testId && entry.questionId === questionId);
  }

  questionsFor(test: TestDefinition): TestQuestion[] {
    return test.questions.filter((question) => this.has(test.id, question.id));
  }

  toggle(testId: string, questionId: string): void {
    const next = this.has(testId, questionId)
      ? this.entries().filter((entry) => entry.testId !== testId || entry.questionId !== questionId)
      : [...this.entries(), { testId, questionId }];
    this.entries.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.storageNotice.set('');
    } catch {
      this.storageNotice.set('Favorites could not be saved on this device. Your changes will last only for this session.');
    }
  }

  private read(): FavoriteReference[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      const seen = new Set<string>();
      return parsed.filter((entry): entry is FavoriteReference => {
        if (!entry || typeof entry !== 'object' || typeof entry.testId !== 'string' || !entry.testId.trim() || typeof entry.questionId !== 'string' || !entry.questionId.trim()) return false;
        const key = JSON.stringify([entry.testId, entry.questionId]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(({ testId, questionId }) => ({ testId, questionId }));
    } catch {
      this.storageNotice.set('Saved favorites could not be loaded. You can still mark favorites for this session.');
      return [];
    }
  }
}
