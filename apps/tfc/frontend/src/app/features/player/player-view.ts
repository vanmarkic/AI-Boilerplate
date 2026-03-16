import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  PageHeaderComponent,
  CardComponent,
  BadgeComponent,
  ButtonDirective,
  ClockDisplayComponent,
  PhaseBadgeComponent,
} from '@aspect/ui';
import { EngineApiService } from '../../core/engine-api.service';
import { ExerciseWsService, WsMessage } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { Subscription } from 'rxjs';

@Component({
  selector: 'tfc-player-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [PageHeaderComponent, CardComponent, BadgeComponent, ButtonDirective, ClockDisplayComponent, PhaseBadgeComponent],
  template: `
    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || 'Exercise Dashboard' }}</span>
        <div class="exercise-header__clocks">
          <ui-clock-display label="RT" [value]="store.rtClock()" />
          <ui-clock-display label="PT" [value]="store.ptClock()" />
          <ui-phase-badge [phase]="store.phase()" />
        </div>
      </header>

      <div class="exercise-overview">
        <ui-card title="Released Events">
          @for (event of visibleEvents(); track event.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm font-medium">{{ event.title }}</span>
              <ui-badge variant="secondary">{{ event.lifecycle }}</ui-badge>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No events released yet.</p>
          }
        </ui-card>

        <ui-card title="Active Issues">
          @for (issue of store.releasedIssues(); track issue.id) {
            <div class="flex items-center justify-between p-sm border-b"
              [class.cursor-pointer]="issue.lifecycle === 'active'"
              (click)="selectIssue(issue.id)">
              <span class="text-sm font-medium">{{ issue.title }}</span>
              <ui-badge [variant]="issue.lifecycle === 'active' ? 'destructive' : 'secondary'">
                {{ issue.lifecycle }}
              </ui-badge>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No issues assigned yet.</p>
          }
        </ui-card>
      </div>

      <div class="exercise-details">
        @if (selectedIssueId()) {
          <ui-card title="Issue Details">
            @for (issue of store.releasedIssues(); track issue.id) {
              @if (issue.id === selectedIssueId()) {
                <p class="text-sm">{{ issue.description }}</p>
                <div class="flex gap-sm mt-md">
                  <ui-badge variant="secondary">{{ issue.trigger_mode }}</ui-badge>
                  <ui-badge variant="secondary">{{ issue.lifecycle }}</ui-badge>
                </div>
              }
            }
          </ui-card>
        } @else {
          <p class="text-muted-foreground text-sm p-sm">
            Select an issue to view details and submit a decision.
          </p>
        }
      </div>

      <footer class="exercise-controls">
        <div class="exercise-controls__group">
          <p class="text-sm text-muted-foreground">
            Waiting for Game Master actions...
          </p>
        </div>
      </footer>
    </div>
  `,
})
export class PlayerView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  private readonly api = inject(EngineApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly selectedIssueId = signal<string | null>(null);
  private readonly exerciseId = signal(1); // TODO: from route param
  private sub: Subscription | null = null;

  protected visibleEvents() {
    return this.store.events().filter(
      (e) => e.lifecycle === 'running' || e.lifecycle === 'completed',
    );
  }

  ngOnInit(): void {
    const id = this.exerciseId();
    this.ws.connect(id, 'player');
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

  protected selectIssue(issueId: string): void {
    this.selectedIssueId.set(issueId);
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
}
