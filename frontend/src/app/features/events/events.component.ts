import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { EventsStore } from './events.store';
import { EventsListComponent } from '../../shared/ui/events-list.component';
import { BadgeComponent } from '../../shared/ui/badge.component';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [EventsListComponent, BadgeComponent],
  providers: [EventsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-xl px-lg py-lg mx-auto" style="max-width: 72rem">
      <div class="flex flex-row items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Events</h1>
          <p class="text-sm text-muted-foreground mt-xs">Manage your upcoming and past events</p>
        </div>
        <app-badge variant="outline">{{ store.items().length }} total</app-badge>
      </div>

      @if (store.loading()) {
        <div class="card flex items-center justify-center py-lg">
          <p class="text-muted-foreground">Loading events...</p>
        </div>
      } @else if (store.error()) {
        <div class="card bg-destructive/10 border border-destructive text-destructive p-md">
          {{ store.error() }}
        </div>
      } @else if (store.items().length > 0) {
        <div class="card">
          <h2 class="card-title">All events</h2>
          <app-events-list [events]="store.items()" />
        </div>
      } @else {
        <div class="card flex items-center justify-center py-lg">
          <p class="text-muted-foreground">No events yet</p>
        </div>
      }
    </div>
  `,
})
export class EventsComponent implements OnInit {
  protected readonly store = new EventsStore();

  ngOnInit(): void {
    this.store.loadEvents();
  }
}
