import type { EventLifecycle } from '../types/event';
import type { IssueLifecycle } from '../types/issue';
import type { ExercisePhase } from '../types/exercise';

export const EVENT_TRANSITIONS: Record<EventLifecycle, EventLifecycle[]> = {
  scheduled: ['pending', 'cancelled'],
  pending: ['running', 'cancelled'],
  running: ['paused', 'completed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const ISSUE_TRANSITIONS: Record<IssueLifecycle, IssueLifecycle[]> = {
  inactive: ['active'],
  active: ['mitigated', 'resolved'],
  mitigated: ['active', 'resolved'],
  resolved: [],
};

export const EXERCISE_TRANSITIONS: Record<ExercisePhase, ExercisePhase[]> = {
  setup: ['running'],
  running: ['paused', 'completed'],
  paused: ['running', 'completed'],
  completed: [],
};
