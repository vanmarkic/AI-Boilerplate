import type { PlayTimeMs } from './time';

export type IssueLifecycle = 'inactive' | 'active' | 'mitigated' | 'resolved';

export type TriggerMode = 'time-based' | 'event-based' | 'manual';

export type ControlMode = 'automatic' | 'manual' | 'hybrid';

export interface Issue {
  id: string;
  title: string;
  description: string;
  lifecycle: IssueLifecycle;
  triggerMode: TriggerMode;
  triggerCondition: string;
  etbol: PlayTimeMs;
  controlMode: ControlMode;
  activatedAt: PlayTimeMs | null;
  resolvedAt: PlayTimeMs | null;
}
