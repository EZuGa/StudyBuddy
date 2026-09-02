export type QuestionType = 'multiple-choice' | 'written' | 'matching' | 'fill-blank';
export type FeedbackMode = 'instant' | 'end';
export type AppPage = 'library' | 'history' | 'taking' | 'written-review' | 'results';

export interface TestQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  exampleAnswer?: string;
  acceptedAnswers?: string[];
  pairs?: Array<{ term: string; definition: string }>;
}

export interface TestDefinition {
  id: string;
  subject: string;
  title: string;
  chapters: string[];
  kind: 'chapter' | 'midterm';
  minutes: number;
  tone: 'sage' | 'sky' | 'amber' | 'lilac' | 'coral';
  questions: TestQuestion[];
}

export interface QuestionAnswer {
  choice?: number;
  text?: string;
  writtenComplete?: boolean;
  revealed?: boolean;
  selfGrade?: boolean;
  checked?: boolean;
  matches?: Record<number, number>;
}

export interface TestAttempt {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  score: number;
  total: number;
  percentage: number;
  mode: FeedbackMode;
  completedAt: string;
}
