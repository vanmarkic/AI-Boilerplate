import type { PlayTimeMs } from './time';

/** Defect lifecycle state. Domain term: "defect lifecycle". Code uses "issue lifecycle". */
export type IssueLifecycle = 'inactive' | 'active' | 'mitigated' | 'resolved';

export type TriggerMode = 'time-based' | 'event-based' | 'manual';

export type ControlMode = 'automatic' | 'manual' | 'hybrid';

/**
 * An exercise defect. Domain term: "defect". Code uses "issue" throughout.
 * Also known as: TrackedDefect, Defect.
 */
export interface Issue {
  id: string;
  title: string;
  description: string;
  lifecycle: IssueLifecycle;
  triggerMode: TriggerMode;
  triggerCondition: string;
  autoResolveMs: PlayTimeMs;
  controlMode: ControlMode;
  activatedAt: PlayTimeMs | null;
  resolvedAt: PlayTimeMs | null;
}
