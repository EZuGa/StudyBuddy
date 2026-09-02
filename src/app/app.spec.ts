import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { TestDefinition } from './models';
import { TestDataService } from './test-data.service';

const testFixture: TestDefinition = {
  id: 'biology-cells', subject: 'Biology', title: 'Cells', chapters: ['Chapter 1'], kind: 'chapter', minutes: 5, tone: 'sage',
  questions: [{ id: 'q1', type: 'multiple-choice', prompt: 'Which organelle makes ATP?', options: ['Nucleus', 'Mitochondrion'], correctAnswer: 1 }],
};

describe('App', () => {
  beforeEach(async () => {
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

  it('renders the library and its loaded tests', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Ready to make it stick?');
    expect(compiled.textContent).toContain('Cells');
    expect(compiled.textContent).toContain('Biology');
  });
});
