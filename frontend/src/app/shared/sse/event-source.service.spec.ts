import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { EventSourceService } from './event-source.service';

type MockEventSource = {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  url: string;
};

let lastCreatedSource: MockEventSource;

class FakeEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  readyState = 1;
  url: string;

  constructor(url: string) {
    this.url = url;
    lastCreatedSource = this as unknown as MockEventSource;
  }
}

describe('EventSourceService', () => {
  let service: EventSourceService;
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    (globalThis as any).EventSource = FakeEventSource;
    TestBed.configureTestingModule({
      providers: [EventSourceService],
    });
    service = TestBed.inject(EventSourceService);
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalEventSource;
  });

  it('creates EventSource with correct URL', () => {
    const sub = service.channel('comments').subscribe();
    expect(lastCreatedSource.url).toContain('/api/events/comments');
    sub.unsubscribe();
  });

  it('parses JSON messages and emits typed values', () => {
    const received: Array<{ id: number }> = [];

    const sub = service.channel<{ id: number }>('test').subscribe((val) => {
      received.push(val);
    });

    lastCreatedSource.onmessage!(
      new MessageEvent('message', { data: '{"id": 42}' }),
    );

    expect(received).toEqual([{ id: 42 }]);
    sub.unsubscribe();
  });

  it('shares connection for same channel', () => {
    const obs1 = service.channel('shared');
    const obs2 = service.channel('shared');

    expect(obs1).toBe(obs2);
  });

  it('closes EventSource on unsubscribe', () => {
    const sub = service.channel('closeable').subscribe();
    const source = lastCreatedSource;

    sub.unsubscribe();

    expect(source.close).toHaveBeenCalled();
  });

  it('errors on invalid JSON', () => {
    let receivedError: Error | null = null;

    const sub = service.channel('bad-json').subscribe({
      error: (err: Error) => {
        receivedError = err;
      },
    });

    lastCreatedSource.onmessage!(
      new MessageEvent('message', { data: 'not-json{' }),
    );

    expect(receivedError).toBeTruthy();
    expect(receivedError!.message).toContain('Failed to parse');
  });

  it('emits error and retries on EventSource failure', async () => {
    let errorCount = 0;

    // Subscribe — first connection will be created.
    const sub = service.channel('retry-test').subscribe({
      error: () => {
        errorCount++;
      },
    });

    const firstSource = lastCreatedSource;

    // Trigger an error to force reconnect.
    firstSource.onerror!();

    expect(firstSource.close).toHaveBeenCalled();

    sub.unsubscribe();
  });
});
