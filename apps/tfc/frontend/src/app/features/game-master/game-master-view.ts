import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { BadgeComponent, ButtonDirective, CardComponent } from '@aspect/ui';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { SpeedDisplayComponent } from '../../shared/speed-display.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { PresenceIndicatorComponent } from '../../shared/presence-indicator.component';
import { EngineApiService } from '../../core/engine-api.service';
import { DecisionApiService } from '../../core/decision-api.service';
import { ExerciseApiService } from '../../core/exercise-api.service';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { ScenarioPickerComponent } from './scenario-picker';
import type { ScenarioResponse } from '../../core/scenario-api.service';
import type { InjectSnapshot, DefectSnapshot } from '../../core/engine-api.service';
import { handleGmWsMessage } from './gm-ws-handler';
import { startExercise, pauseExercise, resetExercise, completeExercise } from './gm-inject-actions';
import { InjectTimelineComponent } from './inject-timeline.component';
import { DetailPanelComponent } from './detail-panel.component';
import { TraineeMonitorComponent } from './trainee-monitor.component';
import { formatTimeMs } from '../../core/format-time';
import { Subscription } from 'rxjs';

type SelectedItem = { kind: 'inject'; item: InjectSnapshot } | { kind: 'defect'; item: DefectSnapshot } | null;

@Component({
  selector: 'tfc-game-master-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    BadgeComponent, ButtonDirective, CardComponent,
    ClockDisplayComponent, PhaseBadgeComponent, SpeedDisplayComponent,
    ContextPanelComponent, ScenarioPickerComponent,
    PresenceIndicatorComponent,
    InjectTimelineComponent, DetailPanelComponent, TraineeMonitorComponent,
  ],
  template: `
    @if (!exerciseId()) {
      <tfc-scenario-picker (scenarioSelected)="onScenarioSelected($event)" />
    } @else {
    <div class="exercise-layout">

      <!-- Row 1: Header -->
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

      <!-- Row 2: Overview (timeline left, defect list right) -->
      <div class="exercise-overview exercise-overview--wide">
        <tfc-inject-timeline
          [injects]="store.injects()"
          [defects]="store.defects()"
          [playTimeMs]="store.playTimeMs()" />

        <ui-card title="Defects">
          @for (defect of store.defects(); track defect.id) {
            <div class="flex items-center justify-between p-sm border-b"
              [class.selected-item]="isSelectedDefect(defect.id)"
              (click)="selectDefect(defect)">
              <div>
                <span class="text-sm font-medium">{{ defect.title }}</span>
                <ui-badge [variant]="defect.lifecycle === 'active' ? 'destructive' : 'secondary'">
                  {{ defect.lifecycle }}
                </ui-badge>
              </div>
              @if (defect.lifecycle === 'active' && defect.auto_resolve_pt_ms > 0) {
                @for (cd of store.defectsWithCountdown(); track cd.id) {
                  @if (cd.id === defect.id) {
                    <span class="text-xs text-muted-foreground">
                      ETBOL: {{ formatMs(cd.remaining_ms) }}
                    </span>
                  }
                }
              }
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No defects loaded.</p>
          }
        </ui-card>
      </div>

      <!-- Row 3: Trainee Monitor -->
      <section class="trainee-monitor">
        <tfc-trainee-monitor
          [participants]="store.participants()"
          [decisions]="store.openDecisions()"
          (closeDecision)="closeDecision($event)" />
      </section>

      <!-- Row 4: Detail Panel (collapsible) -->
      <div class="exercise-details">
        <tfc-detail-panel
          [inject]="selectedInject()"
          [defect]="selectedDefect()"
          (triggerInject)="triggerInject($event)"
          (cancelInject)="cancelInject($event)"
          (completeInject)="completeInject($event)"
          (pauseInject)="pauseInject($event)"
          (resumeInject)="resumeInject($event)"
          (activateDefect)="activateDefect($event)"
          (mitigateDefect)="mitigateDefect($event)"
          (resolveDefect)="resolveDefect($event)" />
        @if (store.context(); as ctx) {
          <tfc-context-panel
            [title]="ctx.title" [briefing]="ctx.briefing"
            [objectives]="ctx.objectives" [rules]="ctx.rules" />
        }
      </div>

      <!-- Row 5: Controls Footer -->
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
  protected readonly exerciseId = signal<number | null>(null);
  protected readonly selectedItem = signal<SelectedItem>(null);
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected readonly selectedInject = () => {
    const s = this.selectedItem();
    return s?.kind === 'inject' ? s.item : null;
  };

  protected readonly selectedDefect = () => {
    const s = this.selectedItem();
    return s?.kind === 'defect' ? s.item : null;
  };

  protected selectDefect(defect: DefectSnapshot): void {
    this.selectedItem.set({ kind: 'defect', item: defect });
  }

  protected isSelectedDefect(id: string): boolean {
    const s = this.selectedItem();
    return s?.kind === 'defect' && s.item.id === id;
  }

  protected formatMs(ms: number): string {
    return formatTimeMs(ms);
  }

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
  protected pauseInject(id: string): void { this.api.pauseInject(this.eid(), id).subscribe(); }
  protected resumeInject(id: string): void { this.api.resumeInject(this.eid(), id).subscribe(); }
  protected activateDefect(id: string): void { this.api.activateDefect(this.eid(), id).subscribe(); }
  protected mitigateDefect(id: string): void { this.api.mitigateDefect(this.eid(), id).subscribe(); }
  protected resolveDefect(id: string): void { this.api.resolveDefect(this.eid(), id).subscribe(); }
}
