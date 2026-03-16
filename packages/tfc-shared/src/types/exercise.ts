import type { RealTimeMs } from './time';
import type { TimeState } from './time';

export type ExercisePhase = 'setup' | 'running' | 'paused' | 'completed';

export type ParticipantRole = 'game-master' | string;

export interface Participant {
  id: string;
  displayName: string;
  role: ParticipantRole;
  connectedAt: RealTimeMs;
  isConnected: boolean;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  phase: ExercisePhase;
  scenarioId: string;
  timeState: TimeState;
  participants: Participant[];
  domainId: string;
  createdAt: RealTimeMs;
}
