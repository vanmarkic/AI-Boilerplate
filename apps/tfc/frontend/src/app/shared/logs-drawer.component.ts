import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from "@angular/core";
import { DrawerPanelComponent } from "@aspect/ui";
import type { AuditEntry } from "../core/audit-api.service";

@Component({
  selector: "tfc-logs-drawer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerPanelComponent],
  template: `
    <ui-drawer-panel side="right" [open]="open()" (closed)="open.set(false)">
      <h2 drawerTitle>Logs</h2>
      <div class="logs-list">
        @for (entry of sortedLogs(); track entry.id) {
          <div class="log-entry" data-testid="log-entry" [attr.data-type]="entry.entry_type">
            <span class="log-time">{{ formatPT(entry.play_time_ms) }}</span>
            <span class="log-action">{{ entry.action }}</span>
            @if (entry.target_id) {
              <span class="log-target">{{ entry.target_id }}</span>
            }
          </div>
        } @empty {
          <p class="logs-empty">No events yet.</p>
        }
      </div>
    </ui-drawer-panel>
  `,
})
export class LogsDrawerComponent {
  readonly open = model(false);
  readonly logs = input<AuditEntry[]>([]);

  protected sortedLogs = computed(() =>
    [...this.logs()].sort((a, b) => a.play_time_ms - b.play_time_ms),
  );

  protected formatPT(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }
}
