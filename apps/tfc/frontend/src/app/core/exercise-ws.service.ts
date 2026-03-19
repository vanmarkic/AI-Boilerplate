import { Injectable, OnDestroy } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "./environment";
import type { TimeSnapshot } from "./engine-api.service";
import type { DecisionOption, ActiveDecision } from "./decision-api.service";
import type { ParticipantPresence } from "./exercise.store";

// ── Discriminated union for WS state changes ─────────────────

export interface WsPhaseChange {
  type: "phase_change";
  action: string;
  phase: string;
  time: TimeSnapshot;
}

export interface WsEventChange {
  type: "event_change";
  event_id: string;
  action: string;
  lifecycle: string;
  title: string;
}

export interface WsIssueChange {
  type: "issue_change";
  issue_id: string;
  action: string;
  lifecycle: string;
  title: string;
  released: boolean;
}

export interface WsDecisionOpened {
  type: "decision_opened";
  id: string;
  decision_id: string;
  event_id: string | null;
  issue_id: string | null;
  title: string;
  description: string;
  question_type: string;
  options: DecisionOption[];
  completion_mode: string;
  target_roles: string[];
  timeout_ms: number;
  max_selections: number | null;
  status: string;
  opened_at_pt_ms: number;
  closed_at_pt_ms: number | null;
  recommendations: Record<string, string>;
}

export interface WsDecisionClosed {
  type: "decision_closed";
  decision_id: string;
  title: string;
  selected_option_ids?: string[];
}

export interface WsScoreChange {
  type: "score_change";
  total_score: number;
  penalty_ms: number;
  next_decision_time_ms: number;
  turn_number: number;
}

export interface WsRecommendationSubmitted {
  type: "recommendation_submitted";
  decision_id: string;
  participant_id: string;
  option_id: string;
}

export interface WsForcedCardApplied {
  type: "forced_card_applied";
  decision_id: string;
  forced_option_id: string;
  reason: string;
}

export interface WsSpeedChange {
  type: "speed_change";
  factor: number;
}

export type WsStateChange =
  | WsPhaseChange
  | WsEventChange
  | WsIssueChange
  | WsDecisionOpened
  | WsDecisionClosed
  | WsScoreChange
  | WsRecommendationSubmitted
  | WsForcedCardApplied
  | WsSpeedChange;

// ── WS message envelope ──────────────────────────────────────

export interface WsStateChangesMessage {
  type: "state_changes";
  changes: WsStateChange[];
}

export interface WsSnapshotMessage {
  type: "snapshot";
  [key: string]: unknown;
}

export interface WsPresenceMessage {
  type: "presence_update";
  participants: ParticipantPresence[];
}

export interface WsExerciseStartedMessage {
  type: "exercise_started";
  exercise_id: number;
  participants: ParticipantPresence[];
}

export interface WsWaitingRoomUpdate {
  type: "waiting_room_update";
  participants: unknown[];
}

export interface WsSimpleMessage {
  type: "exercise_stopped" | "pong";
}

export type WsMessage =
  | WsStateChangesMessage
  | WsSnapshotMessage
  | WsPresenceMessage
  | WsExerciseStartedMessage
  | WsWaitingRoomUpdate
  | WsSimpleMessage;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];
const PING_INTERVAL = 15000;

@Injectable({ providedIn: "root" })
export class ExerciseWsService implements OnDestroy {
  private ws: WebSocket | null = null;
  private readonly _messages$ = new Subject<WsMessage>();
  private readonly _connected$ = new Subject<boolean>();
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastExerciseId = 0;
  private lastRole: "gm" | "player" = "player";
  private lastParticipantId?: string;

  readonly messages$ = this._messages$.asObservable();
  readonly connected$ = this._connected$.asObservable();

  connect(
    exerciseId: number,
    role: "gm" | "player",
    participantId?: string,
  ): void {
    this.intentionalClose = false;
    this.lastExerciseId = exerciseId;
    this.lastRole = role;
    this.lastParticipantId = participantId;
    this.reconnectAttempt = 0;
    this.doConnect(exerciseId, role, participantId);
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._messages$.complete();
    this._connected$.complete();
  }

  private doConnect(
    exerciseId: number,
    role: string,
    participantId?: string,
  ): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    let url = `${environment.wsBaseUrl}/api/exercises/${exerciseId}/ws?role=${role}`;
    if (participantId) {
      url += `&participant_id=${encodeURIComponent(participantId)}`;
    }
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connected$.next(true);
      this.startPing();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsMessage;
        this.reconnectAttempt = 0;
        this._messages$.next(data);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this._connected$.next(false);
      this.stopPing();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this._connected$.next(false);
    };
  }

  private scheduleReconnect(): void {
    const delay =
      RECONNECT_DELAYS[
        Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
      ];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.doConnect(
        this.lastExerciseId,
        this.lastRole,
        this.lastParticipantId,
      );
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
