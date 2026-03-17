import type { PlayTimeMs, RealTimeMs } from './time';

export type QuestionType = 'single-choice' | 'multiple-choice' | 'free-text';

export type CompletionMode =
  | 'all-responses'
  | 'first-response'
  | 'gm-validation'
  | 'timeout';

export interface DecisionOption {
  id: string;
  label: string;
  scoreWeight: number;
}

export type PlayerType = 'advisor' | 'decision_maker';

export interface DecisionConfig {
  question: string;
  questionType: QuestionType;
  options: DecisionOption[];
  targetRoles: string[];
  completionMode: CompletionMode;
  timeoutMs: PlayTimeMs | null;
}

export interface Recommendation {
  participantId: string;
  optionId: string;
}

export interface DecisionResponse {
  participantId: string;
  selectedOptions: string[];
  freeText: string | null;
  submittedAtPT: PlayTimeMs;
  submittedAtRT: RealTimeMs;
}

export interface DecisionPoint {
  id: string;
  eventId: string;
  config: DecisionConfig;
  responses: DecisionResponse[];
  recommendations: Record<string, string>;
  completed: boolean;
}
