import { TestBed } from '@angular/core/testing';
import { EventSourceService } from './event-source.service';

interface MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
  url: string;
}

let lastCreatedSource: MockEventSource;

class FakeEventSource implements Pick<EventSource, 'onmessage' | 'onerror' | 'close' | 'url'> {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
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
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
    TestBed.configureTestingModule({
      providers: [EventSourceService],
    });
    service = TestBed.inject(EventSourceService);
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
  });

  it('creates EventSource with correct URL', () => {
    const sub = service.channel('comments').subscribe();
    expect(lastCreatedSource.url).toContain('/api/events/comments');
    sub.unsubscribe();
  });

  it('parses JSON messages and emits typed values', () => {
    const received: { id: number }[] = [];

    const sub = service.channel<{ id: number }>('test').subscribe((val) => {
      received.push(val);
    });

    lastCreatedSource.onmessage?.(
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

  it('closes EventSource on error', () => {
    service.channel('err-test').subscribe({
      error: () => { /* swallow retry error */ },
    });

    const source = lastCreatedSource;
    source.onerror?.();

    expect(source.close).toHaveBeenCalled();
  });

  it('encodes channel name in URL', () => {
    const sub = service.channel('room:42').subscribe();
    expect(lastCreatedSource.url).toContain('/api/events/room%3A42');
    sub.unsubscribe();
  });
});
