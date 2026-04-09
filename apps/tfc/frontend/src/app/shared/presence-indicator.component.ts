import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BadgeComponent } from '@aspect/ui';
import type { ParticipantPresence } from '../core/exercise.store';

@Component({
  selector: 'tfc-presence-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="presence-list">
      @for (p of participants(); track p.id) {
        <div class="presence-item">
          <span class="presence-dot"
            [class.presence-dot--connected]="p.connected"
            [class.presence-dot--disconnected]="!p.connected"></span>
          <span class="presence-name">{{ p.display_name }}</span>
          <ui-badge variant="secondary">{{ p.role }}</ui-badge>
        </div>
      } @empty {
        <span class="text-muted-foreground text-xs">No participants</span>
      }
    </div>
  `,
  host: { class: 'presence-indicator' },
})
export class PresenceIndicatorComponent {
  readonly participants = input<ParticipantPresence[]>([]);
}
