import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { DecisionPanelComponent } from '../../shared/decision-panel.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { EngineApiService } from '../../core/engine-api.service';
import { ExerciseWsService, WsMessage } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { DecisionApiService } from '../../core/decision-api.service';
import type { ActiveDecision, DecisionDetail } from '../../core/decision-api.service';
import { InjectFeedComponent } from './inject-feed.component';
import { DefectPanelComponent } from './defect-panel.component';
import { handleDecisionWsChanges } from './player-ws-handler';
import { Subscription } from 'rxjs';

@Component({
  selector: 'tfc-player-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    ClockDisplayComponent, PhaseBadgeComponent,
    DecisionPanelComponent, ContextPanelComponent,
    InjectFeedComponent, DefectPanelComponent,
  ],
  template: `
    <div class="player-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || 'Exercise Dashboard' }}</span>
        <div class="exercise-header__clocks">
          <tfc-clock-display label="PT" [value]="store.ptClock()" />
          <tfc-phase-badge [phase]="store.phase()" />
        </div>
      </header>

      <div class="player-main">
        <!-- Left column: inject feed -->
        <div class="player-column">
          <p class="player-column__heading">Inject Feed</p>
          <tfc-inject-feed
            [injects]="store.injects()"
            [playTimeMs]="store.playTimeMs()"
            [playerRole]="store.playerRole()" />
        </div>

        <!-- Center column: defect panel -->
        <div class="player-column">
          <p class="player-column__heading">Defects</p>
          <tfc-defect-panel
            [defects]="store.releasedDefects()"
            [countdowns]="store.defectsWithCountdown()" />
        </div>

        <!-- Right column: context sidebar -->
        <div class="player-column player-sidebar">
          <p class="player-column__heading">Context</p>
          @if (store.context(); as ctx) {
            <tfc-context-panel
              [title]="ctx.title"
              [briefing]="ctx.briefing"
              [objectives]="ctx.objectives"
              [rules]="ctx.rules" />
          } @else {
            <p class="text-muted-foreground text-sm p-sm">No scenario context available.</p>
          }
        </div>
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
          <span class="text-sm text-muted-foreground">
            Role: <strong>{{ store.playerRole() }}</strong>
          </span>
        </div>
        <div class="exercise-controls__spacer"></div>
        <div class="exercise-controls__group">
          @if (showHistory()) {
            <span class="text-xs text-muted-foreground">
              {{ decisionHistory().length }} past decision(s)
            </span>
          }
          <button class="text-sm" (click)="toggleHistory()">
            {{ showHistory() ? 'Hide History' : 'Decision History' }}
          </button>
        </div>
      </footer>

      @if (showHistory()) {
        <div class="exercise-details">
          @for (decision of decisionHistory(); track decision.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm font-medium">{{ decision.title }}</span>
              <span class="text-xs text-muted-foreground">{{ decision.status }}</span>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No past decisions.</p>
          }
        </div>
      }
    </div>
  `,
})
export class PlayerView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  private readonly api = inject(EngineApiService);
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly decisionHistory = signal<DecisionDetail[]>([]);
  protected readonly showHistory = signal(false);
  private readonly exerciseId = signal(1); // TODO: from route param
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

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

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.sub?.unsubscribe();
    this.connSub?.unsubscribe();
  }

  private loadSnapshot(exerciseId: number): void {
    this.api.snapshot(exerciseId).subscribe({
      next: (snap) => this.store.applySnapshot(snap),
      error: () => this.store.setError('Failed to load snapshot'),
    });
  }

  protected toggleHistory(): void {
    this.showHistory.update((v) => !v);
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
        if (change.type === 'inject_change') {
          this.store.updateInject(change['inject_id'] as string, change['lifecycle'] as string);
        }
        if (change.type === 'defect_change') {
          this.store.updateDefect(
            change['defect_id'] as string,
            change['lifecycle'] as string,
            change['released'] as boolean,
          );
        }
        handleDecisionWsChanges(change, this.store);
      }
    }
  }
}
