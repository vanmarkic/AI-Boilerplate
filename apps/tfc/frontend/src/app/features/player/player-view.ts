import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  PageHeaderComponent,
  CardComponent,
  BadgeComponent,
} from '@aspect/ui';

@Component({
  selector: 'tfc-player-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CardComponent, BadgeComponent],
  template: `
    <div class="exercise-layout">
      <!-- Row 1: Header (read-only) -->
      <header class="flex items-center justify-between p-md border-b">
        <ui-page-header title="Exercise Dashboard" />
        <div class="flex items-center gap-md">
          <div class="flex flex-col items-center">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">RT</span>
            <span class="text-lg font-mono font-semibold">{{ rtClock() }}</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">PT</span>
            <span class="text-lg font-mono font-semibold">{{ ptClock() }}</span>
          </div>
          <ui-badge [variant]="phaseBadgeVariant()">{{ currentPhase() }}</ui-badge>
        </div>
      </header>

      <!-- Row 2: Released Events & Active Issues -->
      <div class="grid grid-cols-2 gap-md p-md">
        <ui-card title="Released Events">
          <p class="text-muted-foreground text-sm">
            Events released by the Game Master will appear here as they are
            triggered during the exercise.
          </p>
        </ui-card>
        <ui-card title="Active Issues">
          <p class="text-muted-foreground text-sm">
            Issues requiring your attention will be listed here. Select an
            issue to view details and submit a decision.
          </p>
        </ui-card>
      </div>

      <!-- Row 3: Event/Issue Details (read-only) -->
      <div class="p-md">
        <ui-card title="Details">
          <p class="text-muted-foreground text-sm">
            Select an event or issue above to view its full details,
            attachments, and context information.
          </p>
        </ui-card>
      </div>

      <!-- Row 4: Decision Form -->
      <footer class="p-md border-t">
        <ui-card title="Submit Decision">
          <p class="text-muted-foreground text-sm">
            Select an active issue above to submit your decision. Decision
            forms will appear here based on the issue type.
          </p>
        </ui-card>
      </footer>
    </div>
  `,
})
export class PlayerView {
  protected readonly rtClock = signal('00:00:00');
  protected readonly ptClock = signal('00:00:00');
  protected readonly currentPhase = signal('Setup');
  protected readonly phaseBadgeVariant = signal<'default' | 'secondary'>('secondary');
}
