import type { PlayTimeMs } from './time';
import type { ExerciseEvent } from './event';
import type { Issue } from './issue';

export interface ScenarioPhase {
  id: string;
  title: string;
  order: number;
  durationPT: PlayTimeMs;
  eventIds: string[];
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  domainId: string;
  phases: ScenarioPhase[];
  events: ExerciseEvent[];
  issues: Issue[];
  version: string;
  createdAt: number;
  updatedAt: number;
}
