import type { PlayTimeMs } from './time';
import type { DecisionConfig } from './decision';

export type EventType = 'informational' | 'operational' | 'decision';

export type EventLifecycle =
  | 'scheduled'
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ExecutionMode = 'automatic' | 'manual' | 'conditional';

export interface ExerciseEvent {
  id: string;
  title: string;
  description: string;
  scheduledTime: PlayTimeMs;
  type: EventType;
  lifecycle: EventLifecycle;
  duration: PlayTimeMs | null;
  executionMode: ExecutionMode;
  dependencies: string[];
  triggeredIssues: string[];
  decisionConfig: DecisionConfig | null;
}
