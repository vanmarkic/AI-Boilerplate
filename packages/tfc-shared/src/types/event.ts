import type { PlayTimeMs } from './time';
import type { DecisionConfig } from './decision';

/** Inject type. Domain term: "inject type". Code uses "event type". */
export type EventType = 'informational' | 'operational' | 'decision';

/** Inject lifecycle state. Domain term: "inject lifecycle". Code uses "event lifecycle". */
export type EventLifecycle =
  | 'scheduled'
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ExecutionMode = 'automatic' | 'manual' | 'conditional';

/**
 * An exercise inject. Domain term: "inject". Code uses "event" throughout.
 * Also known as: ExerciseInject, ScheduledInject.
 */
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
