import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { PageHeaderComponent, CardComponent, BadgeComponent } from '@aspect/ui';
import { AuditApiService, AuditEntry } from '../../core/audit-api.service';
import { formatTimeMs } from '../../core/format-time';

@Component({
  selector: 'tfc-review-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CardComponent, BadgeComponent],
  template: `
    <div class="flex flex-col gap-md p-lg">
      <ui-page-header title="Exercise Review" />

      <div class="grid grid-cols-3 gap-md">
        <ui-card title="Timeline Replay">
          @for (entry of auditLog(); track entry.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ entry.action }}</span>
                <span class="text-xs text-muted-foreground">
                  PT {{ formatTime(entry.play_time_ms) }}
                </span>
              </div>
              <ui-badge variant="secondary">{{ entry.entry_type }}</ui-badge>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">
              No audit entries. Run an exercise first.
            </p>
          }
        </ui-card>

        <ui-card title="Event Summary">
          @for (entry of eventEntries(); track entry.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm">{{ entry.target_id }} — {{ entry.action }}</span>
              <span class="text-xs text-muted-foreground">
                {{ formatTime(entry.play_time_ms) }}
              </span>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No event changes recorded.</p>
          }
        </ui-card>

        <ui-card title="Decision Analysis">
          @for (entry of decisionEntries(); track entry.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm">{{ entry.action }}</span>
              <span class="text-xs text-muted-foreground">
                {{ formatTime(entry.play_time_ms) }}
              </span>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">No decision entries recorded.</p>
          }
        </ui-card>
      </div>
    </div>
  `,
})
export class ReviewView implements OnInit {
  private readonly auditApi = inject(AuditApiService);
  protected readonly auditLog = signal<AuditEntry[]>([]);
  private readonly exerciseId = signal(1); // TODO: from route param

  protected eventEntries = () =>
    this.auditLog().filter((e) => e.entry_type === 'event_change');

  protected decisionEntries = () =>
    this.auditLog().filter((e) => e.entry_type === 'decision');

  protected formatTime = formatTimeMs;

  ngOnInit(): void {
    this.auditApi.getLog(this.exerciseId()).subscribe({
      next: (entries) => this.auditLog.set(entries),
    });
  }
}
