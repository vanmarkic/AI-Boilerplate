import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CardComponent, BadgeComponent } from '@aspect/ui';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { DecisionPanelComponent } from '../../shared/decision-panel.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { AmbientBackgroundComponent } from '../../shared/ambient-background.component';
import { TurnBannerComponent } from '../../shared/turn-banner.component';
import { AdvisorBubblesComponent, AdvisorRecommendation } from '../../shared/advisor-bubbles.component';
import { ScoreBarComponent } from '../../shared/score-bar.component';
import { DomainService } from '../../core/domain.service';
import { EngineApiService } from '../../core/engine-api.service';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { formatTimeMs } from '../../core/format-time';
import { DecisionApiService } from '../../core/decision-api.service';
import type { ActiveDecision, DecisionDetail } from '../../core/decision-api.service';
import { Subscription } from 'rxjs';
import { handlePlayerWsMessage } from './player-ws-handler';

@Component({
  selector: 'tfc-player-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    CardComponent, BadgeComponent,
    ClockDisplayComponent, PhaseBadgeComponent, DecisionPanelComponent, ContextPanelComponent,
    AmbientBackgroundComponent, TurnBannerComponent,
    AdvisorBubblesComponent, ScoreBarComponent,
  ],
  template: `
    <tfc-ambient-background />

    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || domain.term('exercise') + ' Dashboard' }}</span>
        <div class="exercise-header__clocks">
          <tfc-clock-display label="RT" [value]="store.rtClock()" />
          <tfc-clock-display label="PT" [value]="store.ptClock()" />
          <tfc-phase-badge [phase]="store.phase()" />
        </div>
      </header>

      @if (store.score(); as score) {
        <tfc-turn-banner
          [label]="'Turn ' + score.turnNumber"
          [turnNumber]="score.turnNumber" />
      }

      <div class="exercise-overview">
        <ui-card [title]="'Released ' + domain.term('event') + 's'">
          @for (event of visibleEvents(); track event.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm font-medium">{{ event.title }}</span>
              <ui-badge variant="secondary">{{ event.lifecycle }}</ui-badge>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No events released yet.</p>
          }
        </ui-card>

        <ui-card [title]="'Active ' + domain.term('issue') + 's'">
          @for (issue of store.releasedIssues(); track issue.id) {
            <div class="flex items-center justify-between p-sm border-b"
              [class.cursor-pointer]="issue.lifecycle === 'active'"
              (click)="selectIssue(issue.id)">
              <span class="text-sm font-medium">{{ issue.title }}</span>
              <ui-badge [variant]="issue.lifecycle === 'active' ? 'destructive' : 'secondary'">
                {{ issue.lifecycle }}
              </ui-badge>
              @if (getIssueCountdown(issue.id); as cd) {
                <span class="text-xs text-muted-foreground ml-sm">Auto-resolve: {{ cd }}</span>
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
            [title]="ctx.title" [briefing]="ctx.briefing"
            [objectives]="ctx.objectives" [rules]="ctx.rules" />
        }

        <ui-card [title]="domain.term('decision') + ' History'">
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

      @if (store.score(); as score) {
        <tfc-score-bar [score]="score" />
      }

      @if (activeDecision(); as decision) {
        <div class="overlay">
          @if (store.isCollaborative() && !store.isDecisionMaker()) {
            <tfc-decision-panel [title]="'[Advisor] ' + decision.title" [description]="decision.description"
              [questionType]="decision.question_type" [options]="decision.options"
              (submitted)="onRecommendationSubmitted(decision, $event)" />
          } @else {
            @if (store.isCollaborative() && advisorRecs(decision).length > 0) {
              <tfc-advisor-bubbles [recommendations]="advisorRecs(decision)" />
            }
            <tfc-decision-panel [title]="decision.title" [description]="decision.description"
              [questionType]="decision.question_type" [options]="decision.options"
              (submitted)="onDecisionSubmitted(decision, $event)" (closed)="store.closeDecision(decision.id)" />
          }
        </div>
      }

      <footer class="exercise-controls">
        <div class="exercise-controls__group">
          <p class="text-sm text-muted-foreground">
            @if (store.isCollaborative()) {
              {{ store.isDecisionMaker() ? 'You are the Decision Maker' : 'You are an Advisor' }}
            } @else { Waiting for {{ domain.term('gameMaster') }} actions... }
          </p>
        </div>
      </footer>
    </div>
  `,
})
export class PlayerView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  protected readonly domain = inject(DomainService);
  private readonly api = inject(EngineApiService);
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly selectedIssueId = signal<string | null>(null);
  protected readonly decisionHistory = signal<DecisionDetail[]>([]);
  private readonly exerciseId = signal(1); // TODO: from route param
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

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

  protected advisorRecs(decision: ActiveDecision): AdvisorRecommendation[] {
    const recs = decision.recommendations || {};
    return Object.entries(recs).map(([pid, oid]) => ({
      participantId: pid,
      participantName: pid,
      optionId: oid,
    }));
  }

  ngOnInit(): void {
    const id = this.exerciseId();
    this.ws.connect(id, 'player');
    this.sub = this.ws.messages$.subscribe((msg) => handlePlayerWsMessage(msg, this.store));
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

  protected onRecommendationSubmitted(
    decision: ActiveDecision,
    event: { selectedOptions: string[]; freeText: string },
  ): void {
    const optionId = event.selectedOptions[0];
    if (!optionId) return;
    this.decisionApi.submitRecommendation(
      this.exerciseId(), decision.id, optionId,
    ).subscribe();
  }

  protected onDecisionSubmitted(
    decision: ActiveDecision,
    event: { selectedOptions: string[]; freeText: string },
  ): void {
    this.decisionApi.submitResponse(Number(decision.id), {
      participant_id: 'current-user',
      participant_name: 'Player',
      selected_options: event.selectedOptions,
      free_text: event.freeText || null,
    }).subscribe({
      next: () => this.store.closeDecision(decision.id),
    });
  }

}
