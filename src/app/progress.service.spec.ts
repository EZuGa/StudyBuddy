import { TestBed } from '@angular/core/testing';
import { ProgressService } from './progress.service';
import { TestAttempt } from './models';

const legacy: TestAttempt = { id: 'legacy', testId: 'terms', testTitle: 'Terms', subject: 'Networking', score: 1, total: 2, percentage: 50, mode: 'instant', completedAt: '2026-09-03T12:00:00Z' };

describe('Terminology progress', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('studydeck-score-history-v2', JSON.stringify([legacy]));
    TestBed.configureTestingModule({ providers: [ProgressService] });
  });

  it('preserves earlier scores as ordinary-direction attempts and separates reverse scores', () => {
    const service = TestBed.inject(ProgressService);
    expect(service.latestFor('terms', 'define')).toEqual(legacy);
    expect(service.latestFor('terms', 'recall')).toBeUndefined();
    service.addAttempt({ ...legacy, id: 'reverse', score: 2, percentage: 100, terminologyDirection: 'recall' });
    expect(service.latestFor('terms', 'define')?.percentage).toBe(50);
    expect(service.bestFor('terms', 'define')?.percentage).toBe(50);
    expect(service.latestFor('terms', 'recall')?.percentage).toBe(100);
    expect(service.bestFor('terms', 'recall')?.percentage).toBe(100);
    expect(service.latestFor('terms')?.id).toBe('reverse');
    expect(JSON.parse(localStorage.getItem('studydeck-score-history-v2')!)).toHaveLength(2);
  });
});
