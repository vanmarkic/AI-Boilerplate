import type { RealTimeMs } from './time';
import type { TimeState } from './time';

export type ExercisePhase = 'setup' | 'running' | 'paused' | 'completed';

export type GameMode = 'classic' | 'simple-collaborative';

export type ParticipantRole = 'game-master' | string;

export interface Participant {
  id: string;
  displayName: string;
  role: ParticipantRole;
  connectedAt: RealTimeMs;
  isConnected: boolean;
}

export interface ScoreState {
  totalScore: number;
  turnNumber: number;
  nextDecisionTimeMs: number;
  penaltyMs: number;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  phase: ExercisePhase;
  gameMode: GameMode;
  scenarioId: string;
  timeState: TimeState;
  participants: Participant[];
  score: ScoreState | null;
  domainId: string;
  createdAt: RealTimeMs;
}
