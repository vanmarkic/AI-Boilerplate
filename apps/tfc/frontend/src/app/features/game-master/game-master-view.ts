import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { BadgeComponent, ButtonDirective, CollapsiblePanelComponent } from '@aspect/ui';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { SpeedDisplayComponent } from '../../shared/speed-display.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { DomainSelectorComponent } from '../../shared/domain-selector.component';
import { PresenceIndicatorComponent } from '../../shared/presence-indicator.component';
import { EngineApiService } from '../../core/engine-api.service';
import { DecisionApiService } from '../../core/decision-api.service';
import type { DecisionDetail } from '../../core/decision-api.service';
import { DomainService } from '../../core/domain.service';
import { ExerciseApiService } from '../../core/exercise-api.service';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { ScenarioPickerComponent } from './scenario-picker';
import type { ScenarioSelection } from './scenario-picker';
import { handleGmWsMessage } from './gm-ws-handler';
import { startExercise, pauseExercise, resetExercise, completeExercise } from './gm-engine-actions';
import { EventTimelineComponent } from './event-timeline.component';
import { GmItemActionsComponent } from './gm-item-actions.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'tfc-game-master-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    BadgeComponent, ButtonDirective, CollapsiblePanelComponent,
    ClockDisplayComponent, PhaseBadgeComponent, SpeedDisplayComponent,
    ContextPanelComponent, ScenarioPickerComponent,
    DomainSelectorComponent, PresenceIndicatorComponent,
    EventTimelineComponent, GmItemActionsComponent,
  ],
  template: `
    @if (!exerciseId()) {
      <tfc-scenario-picker (scenarioSelected)="onScenarioSelected($event)" />
    } @else {
    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || domain.term('exercise') + ' Control Panel' }}</span>
        <tfc-domain-selector />
        <tfc-presence-indicator [participants]="store.participants()" />
        <div class="exercise-header__clocks">
          <tfc-clock-display label="RT" [value]="store.rtClock()" />
          <tfc-clock-display label="PT" [value]="store.ptClock()" />
          <tfc-speed-display [value]="store.speedFactor()" />
          <tfc-phase-badge [phase]="store.phase()" />
        </div>
      </header>

      <tfc-event-timeline
        [events]="store.events()"
        [issues]="store.issues()"
        [playTimeMs]="store.playTimeMs()" />

      <div class="exercise-overview">
        <tfc-gm-item-actions
          [events]="store.events()" [issues]="store.issues()"
          (triggerEvent)="triggerEvent($event)" (completeEvent)="completeEvent($event)"
          (cancelEvent)="cancelEvent($event)" (activateIssue)="activateIssue($event)"
          (mitigateIssue)="mitigateIssue($event)" (resolveIssue)="resolveIssue($event)" />

        <ui-collapsible-panel>
          <span panelTitle>{{ domain.term('decision') }}s</span>
          @for (decision of store.openDecisions(); track decision.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div>
                <span class="text-sm font-medium">{{ decision.title }}</span>
                <ui-badge variant="default">open</ui-badge>
              </div>
              <div class="flex gap-xs">
                <button uiButton variant="outline" size="sm" (click)="viewDecision(decision.id)">View</button>
                <button uiButton variant="destructive" size="sm" (click)="closeDecision(decision.id)">Close</button>
              </div>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No active decisions.</p>
          }
        </ui-collapsible-panel>
      </div>

      <div class="exercise-details">
        <ui-collapsible-panel>
          <span panelTitle>Detail Panel</span>
          @if (selectedDecision(); as detail) {
            <p class="text-sm font-medium">{{ detail.title }}</p>
            <p class="text-sm text-muted-foreground">{{ detail.description }}</p>
            @for (resp of detail.responses; track resp.id) {
              <div class="flex items-center justify-between p-sm border-b">
                <span class="text-sm">{{ resp.participant_name }}</span>
                <span class="text-xs text-muted-foreground">{{ resp.submitted_at }}</span>
              </div>
            } @empty {
              <p class="text-muted-foreground text-sm">No responses yet.</p>
            }
          } @else {
            <p class="text-muted-foreground text-sm">Select a decision to view context.</p>
          }
        </ui-collapsible-panel>
        @if (store.context(); as ctx) {
          <tfc-context-panel
            [title]="ctx.title" [briefing]="ctx.briefing"
            [objectives]="ctx.objectives" [rules]="ctx.rules" />
        }
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
        <tfc-speed-display [value]="store.speedFactor()">
          <input type="range" min="0.5" max="10" step="0.5"
            [value]="store.speedFactor()" (input)="onSpeedChange($event)" />
        </tfc-speed-display>
      </footer>
    </div>
    }
  `,
})
export class GameMasterView implements OnDestroy {
  protected readonly store = inject(ExerciseStore);
  protected readonly domain = inject(DomainService);
  private readonly api = inject(EngineApiService);
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly selectedDecision = signal<DecisionDetail | null>(null);
  protected readonly exerciseId = signal<number | null>(null);
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected onScenarioSelected({ scenario, gameMode }: ScenarioSelection): void {
    if (scenario.domain_id != null) {
      const domainMap: Record<number, string> = { 1: 'cybersecurity', 2: 'healthcare', 3: 'military' };
      this.domain.setDomain(domainMap[scenario.domain_id] ?? 'default');
    }
    this.exerciseApi.create({
      title: scenario.title,
      scenario_id: scenario.id,
      time_factor: scenario.content?.default_time_factor ?? 1.0,
      game_mode: gameMode,
    }).subscribe({
      next: (ex) => { this.exerciseId.set(ex.id); this.connectExercise(ex.id); },
      error: () => this.store.setError('Failed to create exercise'),
    });
  }

  private connectExercise(id: number): void {
    this.ws.connect(id, 'gm');
    this.sub = this.ws.messages$.subscribe((msg) => handleGmWsMessage(msg, this.store));
    this.loadSnapshot(id);
    this.decisionApi.getContext(id).subscribe({ next: (ctx) => this.store.setContext(ctx) });
    this.connSub = this.ws.connected$.subscribe((c) => { if (c) this.loadSnapshot(id); });
  }

  ngOnDestroy(): void { this.ws.disconnect(); this.sub?.unsubscribe(); this.connSub?.unsubscribe(); }

  private loadSnapshot(id: number): void {
    this.api.snapshot(id).subscribe({
      next: (snap) => this.store.applySnapshot(snap),
      error: () => this.store.setError('Failed to load snapshot'),
    });
  }

  protected viewDecision(id: string): void {
    this.decisionApi.getDecisionDetail(Number(id)).subscribe({
      next: (detail) => this.selectedDecision.set(detail),
    });
  }

  protected closeDecision(id: string): void {
    this.decisionApi.closeEngineDecision(this.exerciseId()!, id).subscribe({
      next: () => this.store.closeDecision(id),
    });
  }

  protected onStart(): void { startExercise(this.api, this.store, this.exerciseId()!); }
  protected onPause(): void { pauseExercise(this.api, this.store, this.exerciseId()!); }
  protected onReset(): void { resetExercise(this.api, this.store, this.exerciseId()!); }
  protected onComplete(): void { completeExercise(this.api, this.store, this.exerciseId()!); }
  protected onSpeedChange(e: Event): void {
    this.api.setSpeed(this.exerciseId()!, parseFloat((e.target as HTMLInputElement).value)).subscribe();
  }

  private eid(): number { return this.exerciseId()!; }
  protected triggerEvent(id: string): void { this.api.triggerEvent(this.eid(), id).subscribe(); }
  protected cancelEvent(id: string): void { this.api.cancelEvent(this.eid(), id).subscribe(); }
  protected completeEvent(id: string): void { this.api.completeEvent(this.eid(), id).subscribe(); }
  protected activateIssue(id: string): void { this.api.activateIssue(this.eid(), id).subscribe(); }
  protected mitigateIssue(id: string): void { this.api.mitigateIssue(this.eid(), id).subscribe(); }
  protected resolveIssue(id: string): void { this.api.resolveIssue(this.eid(), id).subscribe(); }
}
