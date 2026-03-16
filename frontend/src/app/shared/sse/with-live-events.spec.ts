import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signalStore, withState } from '@ngrx/signals';
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
  withState<TestState>({ items: [] }),
  withLiveEvents<TestEvent>('test-channel', {
    reduce: (event) => (state) => ({
      items: [...(state['items'] as TestEvent[]), event],
    }),
  }),
);

@Component({
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TestStore],
})
class TestHostComponent {
  readonly store = inject(TestStore);
  readonly injector = inject(Injector);
}

describe('withLiveEvents', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let store: InstanceType<typeof TestStore>;
  let injector: Injector;
  let fakeChannel$: Subject<TestEvent>;
  let mockSseService: { channel: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    fakeChannel$ = new Subject<TestEvent>();
    mockSseService = {
      channel: vi.fn().mockReturnValue(fakeChannel$.asObservable()),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: EventSourceService, useValue: mockSseService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    store = fixture.componentInstance.store;
    injector = fixture.componentInstance.injector;
    fixture.detectChanges();
  });

  function connectInContext(): void {
    runInInjectionContext(injector, () => store.connectLive());
  }

  it('connectLive subscribes to SSE channel', () => {
    connectInContext();

    expect(mockSseService.channel).toHaveBeenCalledWith('test-channel');
  });

  it('liveConnected is true after connectLive', () => {
    expect(store.liveConnected()).toBe(false);

    connectInContext();

    expect(store.liveConnected()).toBe(true);
  });

  it('incoming events update store state via reduce', () => {
    connectInContext();

    fakeChannel$.next({ id: 1, text: 'hello' });
    fakeChannel$.next({ id: 2, text: 'world' });

    expect(store.items()).toEqual([
      { id: 1, text: 'hello' },
      { id: 2, text: 'world' },
    ]);
  });

  it('disconnectLive sets liveConnected to false', () => {
    connectInContext();
    expect(store.liveConnected()).toBe(true);

    store.disconnectLive();
    expect(store.liveConnected()).toBe(false);
  });

  it('disconnectLive stops receiving events', () => {
    connectInContext();

    fakeChannel$.next({ id: 1, text: 'before' });
    store.disconnectLive();
    fakeChannel$.next({ id: 2, text: 'after' });

    expect(store.items()).toEqual([{ id: 1, text: 'before' }]);
  });

  it('connectLive is idempotent', () => {
    connectInContext();
    connectInContext();

    expect(mockSseService.channel).toHaveBeenCalledTimes(1);
  });

  it('DestroyRef cleanup unsubscribes', () => {
    connectInContext();
    fakeChannel$.next({ id: 1, text: 'alive' });

    fixture.destroy();

    expect(fakeChannel$.observed).toBe(false);
  });
});
