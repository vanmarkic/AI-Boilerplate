import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  CardComponent,
  BadgeComponent,
} from '@aspect/ui';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { DecisionPanelComponent } from '../../shared/decision-panel.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { EngineApiService } from '../../core/engine-api.service';
import { ExerciseWsService, WsMessage } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { formatTimeMs } from '../../core/format-time';
import { DecisionApiService } from '../../core/decision-api.service';
import type { ActiveDecision, DecisionDetail } from '../../core/decision-api.service';
import { Subscription } from 'rxjs';
import { handleDecisionWsChanges } from './player-ws-handler';

@Component({
  selector: 'tfc-player-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    CardComponent, BadgeComponent,
    ClockDisplayComponent, PhaseBadgeComponent, DecisionPanelComponent, ContextPanelComponent,
  ],
  template: `
    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || 'Exercise Dashboard' }}</span>
        <div class="exercise-header__clocks">
          <tfc-clock-display label="RT" [value]="store.rtClock()" />
          <tfc-clock-display label="PT" [value]="store.ptClock()" />
          <tfc-phase-badge [phase]="store.phase()" />
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
              @if (getIssueCountdown(issue.id); as cd) {
                <span class="text-xs text-muted-foreground ml-sm">
                  Auto-resolve: {{ cd }}
                </span>
              }
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

        @if (store.context(); as ctx) {
          <tfc-context-panel
            [title]="ctx.title"
            [briefing]="ctx.briefing"
            [objectives]="ctx.objectives"
            [rules]="ctx.rules" />
        }

        <ui-card title="Decision History">
          @for (decision of decisionHistory(); track decision.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm font-medium">{{ decision.title }}</span>
              <ui-badge variant="secondary">{{ decision.status }}</ui-badge>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No past decisions.</p>
          }
        </ui-card>
      </div>

      @if (activeDecision(); as decision) {
        <div class="overlay">
          <tfc-decision-panel
            [title]="decision.title"
            [description]="decision.description"
            [questionType]="decision.question_type"
            [options]="decision.options"
            (submitted)="onDecisionSubmitted(decision, $event)"
            (closed)="store.closeDecision(decision.id)" />
        </div>
      }

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
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly selectedIssueId = signal<string | null>(null);
  protected readonly decisionHistory = signal<DecisionDetail[]>([]);
  private readonly exerciseId = signal(1); // TODO: from route param
  private sub: Subscription | null = null;

  protected visibleEvents() {
    return this.store.events().filter(
      (e) => e.lifecycle === 'running' || e.lifecycle === 'completed',
    );
  }

  protected activeDecision(): ActiveDecision | undefined {
    const role = this.store.playerRole();
    return this.store.openDecisions().find((d) => {
      if (!d.target_roles || d.target_roles.length === 0) return true;
      return d.target_roles.includes(role);
    });
  }

  ngOnInit(): void {
    const id = this.exerciseId();
    this.ws.connect(id, 'player');
    this.sub = this.ws.messages$.subscribe((msg) => this.handleWsMessage(msg));
    this.loadSnapshot(id);
    this.decisionApi.getContext(id).subscribe({
      next: (ctx) => this.store.setContext(ctx),
    });
    this.decisionApi.listDecisions(id, 'closed').subscribe({
      next: (decisions) => this.decisionHistory.set(decisions),
    });
    this.connSub = this.ws.connected$.subscribe((connected) => {
      if (connected) this.loadSnapshot(id);
    });
  }

  private connSub: Subscription | null = null;

  private loadSnapshot(exerciseId: number): void {
    this.api.snapshot(exerciseId).subscribe({
      next: (snap) => this.store.applySnapshot(snap),
      error: () => this.store.setError('Failed to load snapshot'),
    });
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.sub?.unsubscribe();
    this.connSub?.unsubscribe();
  }

  protected getIssueCountdown(issueId: string): string | null {
    const item = this.store.issuesWithCountdown().find((i) => i.id === issueId);
    if (!item || item.remaining_ms <= 0) return null;
    return formatTimeMs(item.remaining_ms);
  }

  protected selectIssue(issueId: string): void {
    this.selectedIssueId.set(issueId);
  }

  protected onDecisionSubmitted(
    decision: ActiveDecision,
    event: { selectedOptions: string[]; freeText: string },
  ): void {
    this.decisionApi.submitResponse(Number(decision.id), {
      participant_id: 'current-user', // TODO: from auth
      participant_name: 'Player',
      selected_options: event.selectedOptions,
      free_text: event.freeText || null,
    }).subscribe({
      next: () => this.store.closeDecision(decision.id),
    });
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
        handleDecisionWsChanges(change, this.store);
      }
    }
  }
}
