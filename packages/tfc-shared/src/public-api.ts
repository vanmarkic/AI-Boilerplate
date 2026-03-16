// Types — Time
export type { PlayTimeMs, RealTimeMs, TimeState } from './types/time';

// Types — Event
export type {
  EventType,
  EventLifecycle,
  ExecutionMode,
  ExerciseEvent,
} from './types/event';

// Types — Issue
export type {
  IssueLifecycle,
  TriggerMode,
  ControlMode,
  Issue,
} from './types/issue';

// Types — Decision
export type {
  QuestionType,
  CompletionMode,
  DecisionOption,
  DecisionConfig,
  DecisionResponse,
  DecisionPoint,
} from './types/decision';

// Types — Exercise
export type {
  ExercisePhase,
  ParticipantRole,
  Participant,
  Exercise,
} from './types/exercise';

// Types — Scenario
export type { ScenarioPhase, Scenario } from './types/scenario';

// Types — Domain
export type {
  TerminologyMap,
  SeverityLevel,
  DomainRole,
  ThemeConfig,
  DomainConfig,
} from './types/domain';

// Constants
export {
  EVENT_TRANSITIONS,
  ISSUE_TRANSITIONS,
  EXERCISE_TRANSITIONS,
} from './constants/lifecycles';

export {
  DEFAULT_DOMAIN,
  CYBERSECURITY_DOMAIN,
  HEALTHCARE_DOMAIN,
} from './constants/domains';
