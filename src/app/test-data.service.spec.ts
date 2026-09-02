import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TestDataService } from './test-data.service';

describe('TestDataService', () => {
  let service: TestDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), TestDataService] });
    service = TestBed.inject(TestDataService);
  });

  it('parses fill-in-the-blank and matching questions', () => {
    const [test] = service.parseTests({
      id: 'mixed-test', subject: 'Science', title: 'Mixed formats', chapters: ['Chapter 1'],
      questions: [
        { id: 'fill', type: 'fill-blank', prompt: 'Water is _____.', acceptedAnswers: ['H2O', 'H₂O'] },
        { id: 'match', type: 'matching', prompt: 'Match the pairs.', pairs: [{ term: 'Atom', definition: 'Smallest unit of an element' }, { term: 'Ion', definition: 'Charged atom' }] },
      ],
    });

    expect(test.questions.map((question) => question.type)).toEqual(['fill-blank', 'matching']);
    expect(test.questions[1].pairs).toHaveLength(2);
  });

  it('rejects a fill-in-the-blank question without accepted answers', () => {
    expect(() => service.parseTests({
      id: 'broken', subject: 'Science', title: 'Broken test', chapters: ['Chapter 1'],
      questions: [{ id: 'fill', type: 'fill-blank', prompt: 'Missing answers' }],
    })).toThrowError(/acceptedAnswers/);
  });
});
