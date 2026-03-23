import { Injectable, OnDestroy } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "./environment";

export interface LobbyWsMessage {
  type: "lobby_update" | "pong";
}

const PING_INTERVAL = 15_000;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16_000];

@Injectable({ providedIn: "root" })
export class LobbyWsService implements OnDestroy {
  private ws: WebSocket | null = null;
  private readonly _updates$ = new Subject<void>();
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /** Emits whenever the server signals a lobby change. */
  readonly updates$ = this._updates$.asObservable();

  connect(): void {
    this.intentionalClose = false;
    this.reconnectAttempt = 0;
    this.doConnect();
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
    this._updates$.complete();
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    const url = `${environment.wsBaseUrl}/api/exercises/lobby/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.startPing();
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: LobbyWsMessage = JSON.parse(event.data);
        this.reconnectAttempt = 0;
        if (data.type === "lobby_update") {
          this._updates$.next();
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    const delay =
      RECONNECT_DELAYS[
        Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
      ];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
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
