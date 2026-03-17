import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CardComponent, BadgeComponent, ButtonDirective, CollapsiblePanelComponent } from '@aspect/ui';
import { ClockDisplayComponent } from '../../shared/clock-display.component';
import { PhaseBadgeComponent } from '../../shared/phase-badge.component';
import { SpeedDisplayComponent } from '../../shared/speed-display.component';
import { ContextPanelComponent } from '../../shared/context-panel.component';
import { EngineApiService } from '../../core/engine-api.service';
import { DecisionApiService } from '../../core/decision-api.service';
import type { DecisionDetail } from '../../core/decision-api.service';
import { ExerciseWsService } from '../../core/exercise-ws.service';
import { ExerciseStore } from '../../core/exercise.store';
import { formatTimeMs } from '../../core/format-time';
import { handleGmWsMessage } from './gm-ws-handler';
import { startExercise, pauseExercise, resetExercise, completeExercise } from './gm-engine-actions';
import { createEventActions, createIssueActions } from './gm-event-actions';
import { Subscription } from 'rxjs';

@Component({
  selector: 'tfc-game-master-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExerciseStore],
  imports: [
    CardComponent, BadgeComponent, ButtonDirective, CollapsiblePanelComponent,
    ClockDisplayComponent, PhaseBadgeComponent, SpeedDisplayComponent, ContextPanelComponent,
  ],
  template: `
    <div class="exercise-layout">
      <header class="exercise-header">
        <span class="exercise-header__title">{{ store.title() || 'Exercise Control Panel' }}</span>
        <div class="exercise-header__clocks">
          <tfc-clock-display label="RT" [value]="store.rtClock()" />
          <tfc-clock-display label="PT" [value]="store.ptClock()" />
          <tfc-speed-display [value]="store.speedFactor()" />
          <tfc-phase-badge [phase]="store.phase()" />
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
                @if (event.lifecycle === 'scheduled') {
                  <button uiButton variant="outline" size="sm" (click)="evt.trigger(event.id)">Trigger</button>
                  <button uiButton variant="outline" size="sm" (click)="evt.delay(event.id)">Delay</button>
                  <button uiButton variant="destructive" size="sm" (click)="evt.skip(event.id)">Skip</button>
                }
                @if (event.lifecycle === 'pending') {
                  <button uiButton variant="outline" size="sm" (click)="evt.trigger(event.id)">Trigger</button>
                }
                @if (event.lifecycle === 'running') {
                  <button uiButton variant="outline" size="sm" (click)="evt.pause(event.id)">Pause</button>
                  <button uiButton variant="outline" size="sm" (click)="evt.complete(event.id)">Complete</button>
                }
                @if (event.lifecycle === 'paused') {
                  <button uiButton variant="outline" size="sm" (click)="evt.resume(event.id)">Resume</button>
                }
                @if (event.lifecycle !== 'completed' && event.lifecycle !== 'cancelled') {
                  <button uiButton variant="destructive" size="sm" (click)="evt.cancel(event.id)">Cancel</button>
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
                @if (getCountdown(issue.id); as cd) {
                  <span class="text-xs text-muted-foreground ml-sm">Auto-resolve: {{ cd }}</span>
                }
              </div>
              <div class="flex gap-xs">
                @if (issue.lifecycle === 'inactive') {
                  <button uiButton variant="outline" size="sm" (click)="iss.activate(issue.id)">Activate</button>
                }
                @if (issue.lifecycle === 'active') {
                  <button uiButton variant="outline" size="sm" (click)="iss.mitigate(issue.id)">Mitigate</button>
                  <button uiButton variant="outline" size="sm" (click)="iss.resolve(issue.id)">Resolve</button>
                }
                @if (issue.lifecycle === 'mitigated') {
                  <button uiButton variant="outline" size="sm" (click)="iss.resolve(issue.id)">Resolve</button>
                }
              </div>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No issues loaded.</p>
          }
        </ui-card>

        <ui-card title="Decisions">
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
        </ui-card>
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
          <tfc-context-panel [title]="ctx.title" [briefing]="ctx.briefing"
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
  `,
})
export class GameMasterView implements OnInit, OnDestroy {
  protected readonly store = inject(ExerciseStore);
  private readonly api = inject(EngineApiService);
  private readonly decisionApi = inject(DecisionApiService);
  private readonly ws = inject(ExerciseWsService);
  protected readonly selectedDecision = signal<DecisionDetail | null>(null);
  private readonly exerciseId = signal(1);
  private sub: Subscription | null = null;
  private connSub: Subscription | null = null;

  protected readonly evt = createEventActions(this.api, () => this.exerciseId());
  protected readonly iss = createIssueActions(this.api, () => this.exerciseId());

  ngOnInit(): void {
    const id = this.exerciseId();
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

  protected getCountdown(issueId: string): string | null {
    const item = this.store.issuesWithCountdown().find((i) => i.id === issueId);
    return item && item.remaining_ms > 0 ? formatTimeMs(item.remaining_ms) : null;
  }

  protected viewDecision(id: string): void {
    this.decisionApi.getDecisionDetail(Number(id)).subscribe({ next: (d) => this.selectedDecision.set(d) });
  }

  protected closeDecision(id: string): void {
    this.decisionApi.closeEngineDecision(this.exerciseId(), id).subscribe({ next: () => this.store.closeDecision(id) });
  }

  protected onStart(): void { startExercise(this.api, this.store, this.exerciseId()); }
  protected onPause(): void { pauseExercise(this.api, this.store, this.exerciseId()); }
  protected onReset(): void { resetExercise(this.api, this.store, this.exerciseId()); }
  protected onComplete(): void { completeExercise(this.api, this.store, this.exerciseId()); }

  protected onSpeedChange(event: Event): void {
    this.api.setSpeed(this.exerciseId(), parseFloat((event.target as HTMLInputElement).value)).subscribe();
  }
}
