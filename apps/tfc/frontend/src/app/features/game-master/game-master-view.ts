import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  PageHeaderComponent,
  CardComponent,
  BadgeComponent,
  ButtonDirective,
  CollapsiblePanelComponent,
} from '@aspect/ui';
import { EngineApiService } from '../../core/engine-api.service';
import { ExerciseWsService, WsMessage } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { Subscription } from 'rxjs';

@Component({
  selector: 'tfc-game-master-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    PageHeaderComponent, CardComponent, BadgeComponent,
    ButtonDirective, CollapsiblePanelComponent,
  ],
  template: `
    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || 'Exercise Control Panel' }}</span>
        <div class="exercise-header__clocks">
          <div class="exercise-clock">
            <span class="exercise-clock__label">RT</span>
            <span class="exercise-clock__value">{{ store.rtClock() }}</span>
          </div>
          <div class="exercise-clock">
            <span class="exercise-clock__label">PT</span>
            <span class="exercise-clock__value">{{ store.ptClock() }}</span>
          </div>
          <div class="exercise-speed">
            <span class="exercise-speed__label">Speed</span>
            <span class="exercise-speed__value">{{ store.speedFactor() }}x</span>
          </div>
          <span class="exercise-phase" [attr.data-phase]="store.phase()">
            {{ store.phase() }}
          </span>
        </div>
      </header>

      <div class="exercise-overview">
        <ui-card title="Event Timeline">
          @for (event of store.events(); track event.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div>
                <span class="text-sm font-medium">{{ event.title }}</span>
                <span class="text-xs text-muted-foreground ml-sm">{{ event.lifecycle }}</span>
              </div>
              <div class="flex gap-xs">
                @if (event.lifecycle === 'scheduled' || event.lifecycle === 'pending') {
                  <button uiButton variant="outline" size="sm"
                    (click)="triggerEvent(event.id)">Trigger</button>
                }
                @if (event.lifecycle === 'running') {
                  <button uiButton variant="outline" size="sm"
                    (click)="completeEvent(event.id)">Complete</button>
                }
                @if (event.lifecycle !== 'completed' && event.lifecycle !== 'cancelled') {
                  <button uiButton variant="destructive" size="sm"
                    (click)="cancelEvent(event.id)">Cancel</button>
                }
              </div>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No events loaded.</p>
          }
        </ui-card>

        <ui-card title="Issues">
          @for (issue of store.issues(); track issue.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div>
                <span class="text-sm font-medium">{{ issue.title }}</span>
                <ui-badge [variant]="issue.lifecycle === 'active' ? 'destructive' : 'secondary'">
                  {{ issue.lifecycle }}
                </ui-badge>
              </div>
              <div class="flex gap-xs">
                @if (issue.lifecycle === 'inactive') {
                  <button uiButton variant="outline" size="sm"
                    (click)="activateIssue(issue.id)">Activate</button>
                }
                @if (issue.lifecycle === 'active') {
                  <button uiButton variant="outline" size="sm"
                    (click)="mitigateIssue(issue.id)">Mitigate</button>
                  <button uiButton variant="outline" size="sm"
                    (click)="resolveIssue(issue.id)">Resolve</button>
                }
                @if (issue.lifecycle === 'mitigated') {
                  <button uiButton variant="outline" size="sm"
                    (click)="resolveIssue(issue.id)">Resolve</button>
                }
              </div>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No issues loaded.</p>
          }
        </ui-card>
      </div>

      <div class="exercise-details">
        <ui-collapsible-panel>
          <span panelTitle>Detail Panel</span>
          <p class="text-muted-foreground text-sm">
            Select an event or issue to view full context.
          </p>
        </ui-collapsible-panel>
      </div>

      <footer class="exercise-controls">
        <div class="exercise-controls__group">
          @if (store.phase() === 'setup' || store.phase() === 'paused') {
            <button uiButton variant="default" (click)="onStart()">
              {{ store.phase() === 'setup' ? 'Start' : 'Resume' }}
            </button>
          }
          @if (store.phase() === 'running') {
            <button uiButton variant="outline" (click)="onPause()">Pause</button>
          }
          @if (store.phase() !== 'setup') {
            <button uiButton variant="outline" (click)="onComplete()">Complete</button>
          }
          <button uiButton variant="destructive" (click)="onReset()">Reset</button>
        </div>
        <div class="exercise-controls__spacer"></div>
        <div class="exercise-speed">
          <span class="exercise-speed__label">Speed</span>
          <input type="range" min="0.5" max="10" step="0.5"
            [value]="store.speedFactor()"
            (input)="onSpeedChange($event)" />
          <span class="exercise-speed__value">{{ store.speedFactor() }}x</span>
        </div>
      </footer>
    </div>
  `,
})
export class GameMasterView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  private readonly api = inject(EngineApiService);
  private readonly ws = inject(ExerciseWsService);
  private readonly exerciseId = signal(1); // TODO: from route param
  private sub: Subscription | null = null;

  ngOnInit(): void {
    const id = this.exerciseId();
    this.ws.connect(id, 'gm');
    this.sub = this.ws.messages$.subscribe((msg) => this.handleWsMessage(msg));
    this.api.snapshot(id).subscribe({
      next: (snap) => this.store.applySnapshot(snap),
      error: () => this.store.setError('Failed to load snapshot'),
    });
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.sub?.unsubscribe();
  }

  private handleWsMessage(msg: WsMessage): void {
    if (msg.type === 'snapshot') {
      this.store.applySnapshot(msg as never);
    }
    if (msg.type === 'state_changes' && msg.changes) {
      for (const change of msg.changes) {
        if (change.type === 'phase_change') {
          this.store.applyPhaseChange(change['phase'] as string);
          if (change['time']) {
            this.store.applyTimeUpdate(change['time'] as never);
          }
        }
        if (change.type === 'event_change') {
          this.store.updateEvent(change['event_id'] as string, change['lifecycle'] as string);
        }
        if (change.type === 'issue_change') {
          this.store.updateIssue(
            change['issue_id'] as string,
            change['lifecycle'] as string,
            change['released'] as boolean,
          );
        }
      }
    }
  }

  protected onStart(): void {
    this.api.start(this.exerciseId()).subscribe({
      next: (r) => {
        this.store.applyPhaseChange(r.phase);
        this.store.applyTimeUpdate(r.time);
      },
    });
  }

  protected onPause(): void {
    this.api.pause(this.exerciseId()).subscribe({
      next: (r) => {
        this.store.applyPhaseChange(r.phase);
        this.store.applyTimeUpdate(r.time);
      },
    });
  }

  protected onReset(): void {
    this.api.reset(this.exerciseId()).subscribe({
      next: (r) => {
        this.store.applyPhaseChange(r.phase);
        this.store.applyTimeUpdate(r.time);
      },
    });
  }

  protected onComplete(): void {
    this.api.complete(this.exerciseId()).subscribe({
      next: (r) => {
        this.store.applyPhaseChange(r.phase);
        this.store.applyTimeUpdate(r.time);
      },
    });
  }

  protected onSpeedChange(event: Event): void {
    const factor = parseFloat((event.target as HTMLInputElement).value);
    this.api.setSpeed(this.exerciseId(), factor).subscribe();
  }

  protected triggerEvent(eventId: string): void {
    this.api.triggerEvent(this.exerciseId(), eventId).subscribe();
  }

  protected cancelEvent(eventId: string): void {
    this.api.cancelEvent(this.exerciseId(), eventId).subscribe();
  }

  protected completeEvent(eventId: string): void {
    this.api.completeEvent(this.exerciseId(), eventId).subscribe();
  }

  protected activateIssue(issueId: string): void {
    this.api.activateIssue(this.exerciseId(), issueId).subscribe();
  }

  protected mitigateIssue(issueId: string): void {
    this.api.mitigateIssue(this.exerciseId(), issueId).subscribe();
  }

  protected resolveIssue(issueId: string): void {
    this.api.resolveIssue(this.exerciseId(), issueId).subscribe();
  }
}
