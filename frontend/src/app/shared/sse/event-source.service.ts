/**
 * Low-level, zone-free wrapper around the browser EventSource API.
 *
 * Responsibilities:
 *  - Build the SSE URL from channel name + environment config
 *  - Auto-reconnect with exponential back-off (1s → 2s → 4s → 8s cap)
 *  - Expose an RxJS Observable<T> per channel (cold — connects on first
 *    subscribe, disconnects when all subscribers leave)
 *  - Ref-counted: multiple consumers of the same channel share one
 *    EventSource connection (multicast via shareReplay)
 *
 * Usage:
 *   private sse = inject(EventSourceService);
 *   comments$ = this.sse.channel<CommentResponse>('comments');
 */

import { Injectable } from '@angular/core';
import { Observable, retry, shareReplay, Subject, timer } from 'rxjs';
import { environment } from '../../core/environment';

const MAX_RETRY_DELAY_MS = 8_000;

@Injectable({ providedIn: 'root' })
export class EventSourceService {
  private readonly connections = new Map<string, Observable<unknown>>();

  /**
   * Subscribe to a named SSE channel.
   *
   * Returns a shared Observable that emits parsed JSON payloads.
   * The underlying EventSource is created lazily on first subscription
   * and closed when the last subscriber unsubscribes.
   */
  channel<T>(name: string): Observable<T> {
    const existing = this.connections.get(name);
    if (existing) {
      return existing as Observable<T>;
    }

    const stream$ = this.createStream<T>(name).pipe(
      retry({
        delay: (_error, retryCount) =>
          timer(Math.min(1_000 * 2 ** retryCount, MAX_RETRY_DELAY_MS)),
      }),
      shareReplay({ bufferSize: 0, refCount: true }),
    );

    this.connections.set(name, stream$);
    return stream$;
  }

  private createStream<T>(channel: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const url = `${environment.apiBaseUrl}/api/events/${encodeURIComponent(channel)}`;
      const source = new EventSource(url);

      source.onmessage = (event: MessageEvent<string>) => {
        try {
          subscriber.next(JSON.parse(event.data) as T);
        } catch {
          subscriber.error(new Error(`Failed to parse SSE payload: ${event.data}`));
        }
      };

      source.onerror = () => {
        source.close();
        subscriber.error(new Error(`EventSource error on channel "${channel}"`));
      };

      return () => {
        source.close();
        this.connections.delete(channel);
      };
    });
  }
}
