import { Component, input } from '@angular/core';
import { BadgeComponent } from './badge.component';

export interface Event {
  id: string;
  title: string;
  description: string;
  time: string;
  status: 'upcoming' | 'in-progress' | 'completed';
  type: 'meeting' | 'deadline' | 'milestone' | 'notification';
  badge: 'default' | 'secondary' | 'destructive' | 'outline';
}

@Component({
  selector: 'app-events-list',
  imports: [BadgeComponent],
  template: `
    <div class="flex flex-col gap-sm">
      @for (event of events(); track event.id) {
        <div class="flex flex-col gap-xs py-sm" style="border-bottom: 1px solid var(--color-border)">
          <div class="flex flex-row items-center justify-between">
            <span class="text-sm text-foreground font-medium">{{ event.title }}</span>
            <app-badge [variant]="event.badge">{{ event.status }}</app-badge>
          </div>
          <p class="text-xs text-muted-foreground">{{ event.description }}</p>
          <p class="text-xs text-muted-foreground" style="opacity: 0.6">{{ event.time }}</p>
        </div>
      }
    </div>
  `,
})
export class EventsListComponent {
  readonly events = input<Event[]>();
}
