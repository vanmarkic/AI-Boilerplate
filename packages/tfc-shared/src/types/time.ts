export type PlayTimeMs = number & { __brand: 'PlayTimeMs' };
export type RealTimeMs = number & { __brand: 'RealTimeMs' };

export interface TimeState {
  playTime: PlayTimeMs;
  realTime: RealTimeMs;
  factor: number;
  paused: boolean;
  lastTickRealTime: RealTimeMs;
}
