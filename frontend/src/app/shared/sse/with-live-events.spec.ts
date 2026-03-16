import { Component, DestroyRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { Subject } from 'rxjs';
import { EventSourceService } from './event-source.service';
import { withLiveEvents } from './with-live-events';

interface TestEvent {
  id: number;
  text: string;
}

interface TestState {
  items: TestEvent[];
}

const TestStore = signalStore(
  { providedIn: 'root' },
  withState<TestState>({ items: [] }),
  withLiveEvents<TestEvent, TestState>('test-channel', {
    append: (state, event) => ({ items: [...state.items, event] }),
  }),
);

@Component({
  template: '',
  providers: [TestStore],
})
class TestHostComponent {
  readonly store = inject(TestStore);
}

describe('withLiveEvents', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let store: InstanceType<typeof TestStore>;
  let fakeChannel$: Subject<TestEvent>;
  let mockSseService: { channel: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    fakeChannel$ = new Subject<TestEvent>();
    mockSseService = {
      channel: vi.fn().mockReturnValue(fakeChannel$.asObservable()),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    })
      .overrideProvider(EventSourceService, { useValue: mockSseService })
      .compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    store = fixture.componentInstance.store;
    fixture.detectChanges();
  });

  it('connectLive subscribes to SSE channel', () => {
    store.connectLive();

    expect(mockSseService.channel).toHaveBeenCalledWith('test-channel');
  });

  it('liveConnected is true after connectLive', () => {
    expect(store.liveConnected()).toBe(false);

    store.connectLive();

    expect(store.liveConnected()).toBe(true);
  });

  it('incoming events update store state via append', () => {
    store.connectLive();

    fakeChannel$.next({ id: 1, text: 'hello' });
    fakeChannel$.next({ id: 2, text: 'world' });

    expect(store.items()).toEqual([
      { id: 1, text: 'hello' },
      { id: 2, text: 'world' },
    ]);
  });

  it('disconnectLive sets liveConnected to false', () => {
    store.connectLive();
    expect(store.liveConnected()).toBe(true);

    store.disconnectLive();
    expect(store.liveConnected()).toBe(false);
  });

  it('disconnectLive stops receiving events', () => {
    store.connectLive();

    fakeChannel$.next({ id: 1, text: 'before' });
    store.disconnectLive();
    fakeChannel$.next({ id: 2, text: 'after' });

    expect(store.items()).toEqual([{ id: 1, text: 'before' }]);
  });

  it('connectLive is idempotent', () => {
    store.connectLive();
    store.connectLive();

    expect(mockSseService.channel).toHaveBeenCalledTimes(1);
  });

  it('DestroyRef cleanup unsubscribes', () => {
    store.connectLive();
    fakeChannel$.next({ id: 1, text: 'alive' });

    fixture.destroy();

    fakeChannel$.next({ id: 2, text: 'dead' });
    // Cannot read liveConnected after destroy, but the Subject
    // subscriber count proves cleanup happened.
    expect(fakeChannel$.observed).toBe(false);
  });
});
