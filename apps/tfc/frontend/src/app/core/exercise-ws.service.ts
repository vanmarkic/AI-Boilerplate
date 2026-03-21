import { Injectable, OnDestroy } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "./environment";
import type { SnapshotWithScore } from "./engine-api.service";
import type { ParticipantPresence } from "./exercise.store";
import type { ParticipantResponse } from "./waiting-room-api.service";
import type { StateChange } from "./generated/state-changes.types";

// Re-export for consumers
export type { StateChange } from "./generated/state-changes.types";
export type {
  PhaseChange,
  EventChange,
  IssueChange,
  DecisionOpened,
  DecisionClosed,
  ScoreChange,
  RecommendationSubmitted,
  ForcedCardApplied,
  SpeedChange,
} from "./generated/state-changes.types";

// ── WS message envelope ──────────────────────────────────────

export interface WsStateChangesMessage {
  type: "state_changes";
  changes: StateChange[];
}

export interface WsSnapshotMessage extends SnapshotWithScore {
  type: "snapshot";
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
  participants: ParticipantResponse[];
}

export interface WsSimpleMessage {
  type: "exercise_stopped" | "pong";
  reason?: string;
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

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: WsMessage = JSON.parse(event.data);
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
