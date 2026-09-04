export type QuestionType = 'multiple-choice' | 'multiple-select' | 'written' | 'matching' | 'fill-blank';
export type FeedbackMode = 'instant' | 'end';
export type TerminologyDirection = 'define' | 'recall';
export type PracticeScope = 'all' | 'favorites';
export type AppPage = 'library' | 'history' | 'taking' | 'written-review' | 'results';

export interface TestQuestion {
  id: string;
  number?: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  explanation?: string;
  exampleAnswer?: string;
  term?: string;
  acceptedTerms?: string[];
  acceptedAnswers?: string[];
  pairs?: Array<{ term: string; definition: string }>;
}

export interface TestDefinition {
  id: string;
  category?: 'general' | 'terminology';
  subject: string;
  title: string;
  chapters: string[];
  kind: 'chapter' | 'midterm';
  minutes: number;
  tone: 'sage' | 'sky' | 'amber' | 'lilac' | 'coral';
  questions: TestQuestion[];
}

// The on-disk library owns both practice activities within each chapter.
// TestDefinition is the derived, flat session model used by grading/history.
export interface ChapterData {
  id: string;
  subject: string;
  title: string;
  kind: 'chapter' | 'midterm';
  chapters?: string[]; // Covered chapter titles, for midterms only.
  quiz?: ChapterQuizData;
  terminology?: Omit<ChapterQuizData, 'questions'> & { questions: TerminologyEntry[] };
}

export interface ChapterQuizData {
  id: string;
  title: string;
  minutes: number;
  tone: TestDefinition['tone'];
  questions: TestQuestion[];
}

export interface TerminologyEntry {
  id: string;
  number?: string;
  type: 'written';
  term: string;
  definition: string;
  acceptedTerms?: string[];
}

export interface QuestionAnswer {
  choice?: number;
  choices?: number[];
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
  terminologyDirection?: TerminologyDirection;
  practiceScope?: PracticeScope;
  completedAt: string;
}
