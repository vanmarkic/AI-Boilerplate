import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { BadgeComponent, ButtonDirective, CollapsiblePanelComponent } from '@aspect/ui';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { SpeedDisplayComponent } from '../../shared/speed-display.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { PresenceIndicatorComponent } from '../../shared/presence-indicator.component';
import { EngineApiService } from '../../core/engine-api.service';
import { DecisionApiService } from '../../core/decision-api.service';
import type { DecisionDetail } from '../../core/decision-api.service';
import { ExerciseApiService } from '../../core/exercise-api.service';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { ScenarioPickerComponent } from './scenario-picker';
import type { ScenarioResponse } from '../../core/scenario-api.service';
import { handleGmWsMessage } from './gm-ws-handler';
import { startExercise, pauseExercise, resetExercise, completeExercise } from './gm-inject-actions';
import { InjectTimelineComponent } from './inject-timeline.component';
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
    PresenceIndicatorComponent,
    InjectTimelineComponent, GmItemActionsComponent,
  ],
  template: `
    @if (!exerciseId()) {
      <tfc-scenario-picker (scenarioSelected)="onScenarioSelected($event)" />
    } @else {
    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || 'Exercise Control Panel' }}</span>
        <tfc-presence-indicator [participants]="store.participants()" />
        <div class="exercise-header__clocks">
          <tfc-clock-display label="RT" [value]="store.rtClock()" />
          <tfc-clock-display label="PT" [value]="store.ptClock()" />
          <tfc-speed-display [value]="store.speedFactor()" />
          <tfc-phase-badge [phase]="store.phase()" />
        </div>
      </header>

      <tfc-inject-timeline
        [injects]="store.injects()"
        [defects]="store.defects()"
        [playTimeMs]="store.playTimeMs()" />

      <div class="exercise-overview">
        <tfc-gm-item-actions
          [injects]="store.injects()" [defects]="store.defects()"
          (triggerInject)="triggerInject($event)" (completeInject)="completeInject($event)"
          (cancelInject)="cancelInject($event)" (activateDefect)="activateDefect($event)"
          (mitigateDefect)="mitigateDefect($event)" (resolveDefect)="resolveDefect($event)" />

        <ui-collapsible-panel>
          <span panelTitle>Decisions</span>
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
  private readonly api = inject(EngineApiService);
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly selectedDecision = signal<DecisionDetail | null>(null);
  protected readonly exerciseId = signal<number | null>(null);
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected onScenarioSelected(scenario: ScenarioResponse): void {
    this.exerciseApi.create({
      title: scenario.title,
      scenario_id: scenario.id,
      time_factor: scenario.content?.default_time_factor ?? 1.0,
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
  protected triggerInject(id: string): void { this.api.triggerInject(this.eid(), id).subscribe(); }
  protected cancelInject(id: string): void { this.api.cancelInject(this.eid(), id).subscribe(); }
  protected completeInject(id: string): void { this.api.completeInject(this.eid(), id).subscribe(); }
  protected activateDefect(id: string): void { this.api.activateDefect(this.eid(), id).subscribe(); }
  protected mitigateDefect(id: string): void { this.api.mitigateDefect(this.eid(), id).subscribe(); }
  protected resolveDefect(id: string): void { this.api.resolveDefect(this.eid(), id).subscribe(); }
}
