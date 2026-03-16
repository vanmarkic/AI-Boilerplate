import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  PageHeaderComponent,
  CardComponent,
  BadgeComponent,
  ButtonDirective,
} from '@aspect/ui';

@Component({
  selector: 'tfc-game-master-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CardComponent, BadgeComponent, ButtonDirective],
  template: `
    <div class="exercise-layout">
      <!-- Row 1: Header -->
      <header class="flex items-center justify-between p-md border-b">
        <ui-page-header title="Exercise Control Panel" />
        <div class="flex items-center gap-md">
          <div class="flex flex-col items-center">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">RT</span>
            <span class="text-lg font-mono font-semibold">{{ rtClock() }}</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">PT</span>
            <span class="text-lg font-mono font-semibold">{{ ptClock() }}</span>
          </div>
          <div class="flex items-center gap-sm">
            <span class="text-sm text-muted-foreground">Speed</span>
            <span class="font-mono font-semibold">{{ speedFactor() }}x</span>
          </div>
          <ui-badge [variant]="phaseBadgeVariant()">{{ currentPhase() }}</ui-badge>
        </div>
      </header>

      <!-- Row 2: Overview -->
      <div class="grid grid-cols-2 gap-md p-md">
        <ui-card title="Event Timeline">
          <p class="text-muted-foreground text-sm">
            Event timeline will be displayed here. Events are injected based on
            the scenario schedule and GM triggers.
          </p>
        </ui-card>
        <ui-card title="Active Issues">
          <p class="text-muted-foreground text-sm">
            Issue list will be displayed here. Issues are generated from events
            and require player decisions.
          </p>
        </ui-card>
      </div>

      <!-- Row 3: Details -->
      <div class="p-md">
        <ui-card title="Detail Panel">
          <p class="text-muted-foreground text-sm">
            Select an event or issue above to view details. This panel will
            show full context, attachments, and decision history.
          </p>
        </ui-card>
      </div>

      <!-- Row 4: Controls -->
      <footer class="flex items-center gap-md p-md border-t">
        <button uiButton variant="default" (click)="onPlay()">Play</button>
        <button uiButton variant="outline" (click)="onPause()">Pause</button>
        <button uiButton variant="destructive" (click)="onReset()">Reset</button>
      </footer>
    </div>
  `,
})
export class GameMasterView {
  protected readonly rtClock = signal('00:00:00');
  protected readonly ptClock = signal('00:00:00');
  protected readonly speedFactor = signal(1);
  protected readonly currentPhase = signal('Setup');
  protected readonly phaseBadgeVariant = signal<'default' | 'secondary'>('secondary');

  protected onPlay(): void {
    // TODO: dispatch play action via exercise store
  }

  protected onPause(): void {
    // TODO: dispatch pause action via exercise store
  }

  protected onReset(): void {
    // TODO: dispatch reset action via exercise store
  }
}
