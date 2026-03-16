import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from './environment';

export interface WsStateChange {
  type: string;
  [key: string]: unknown;
}

export interface WsMessage {
  type: 'state_changes' | 'snapshot';
  changes?: WsStateChange[];
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ExerciseWsService implements OnDestroy {
  private ws: WebSocket | null = null;
  private readonly _messages$ = new Subject<WsMessage>();
  private readonly _connected$ = new Subject<boolean>();

  readonly messages$ = this._messages$.asObservable();
  readonly connected$ = this._connected$.asObservable();

  connect(exerciseId: number, role: 'gm' | 'player'): void {
    this.disconnect();
    const url = `${environment.wsBaseUrl}/api/exercises/${exerciseId}/ws?role=${role}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this._connected$.next(true);

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsMessage;
        this._messages$.next(data);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => this._connected$.next(false);
    this.ws.onerror = () => this._connected$.next(false);
  }

  disconnect(): void {
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
}
