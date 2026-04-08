import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { BadgeComponent } from "@aspect/ui";
import type { IssueSnapshot } from "../../core/generated/state-changes.types";
import { formatTimeMs } from "../../core/format-time";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

@Component({
  selector: "tfc-defect-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  host: { class: "defect-panel" },
  template: `
    <h2 class="defect-panel__heading">Defects</h2>

    @if (activeIssues().length === 0 && resolvedIssues().length === 0) {
      <p class="defect-panel__empty">No active defects</p>
    }

    @for (issue of activeIssues(); track issue.id) {
      <div
        class="defect-panel__card"
        [attr.data-severity]="severityKey(issue)"
      >
        <div class="defect-panel__card-header">
          <span class="defect-panel__card-title">{{ issue.title }}</span>
          <ui-badge [variant]="badgeVariant(issue.lifecycle)">{{
            issue.lifecycle
          }}</ui-badge>
        </div>
        @if (issue.auto_resolve_pt_ms > 0) {
          <div class="defect-panel__countdown">
            ETBOL {{ countdown(issue) }}
          </div>
        }
      </div>
    }

    @if (resolvedIssues().length > 0) {
      <details class="defect-panel__resolved-section">
        <summary class="defect-panel__resolved-toggle">
          Resolved ({{ resolvedIssues().length }})
        </summary>
        @for (issue of resolvedIssues(); track issue.id) {
          <div class="defect-panel__card" data-severity="resolved">
            <div class="defect-panel__card-header">
              <span class="defect-panel__card-title">{{ issue.title }}</span>
              <ui-badge variant="secondary">{{ issue.lifecycle }}</ui-badge>
            </div>
          </div>
        }
      </details>
    }
  `,
})
export class DefectPanelComponent {
  readonly issues = input<IssueSnapshot[]>([]);
  readonly playTimeMs = input(0);

  protected readonly activeIssues = computed(() =>
    this.issues().filter(
      (i) => i.lifecycle === "active" || i.lifecycle === "mitigated",
    ),
  );

  protected readonly resolvedIssues = computed(() =>
    this.issues().filter((i) => i.lifecycle === "resolved"),
  );

  protected severityKey(
    issue: IssueSnapshot,
  ): "active" | "mitigated" | "resolved" {
    if (issue.lifecycle === "mitigated") return "mitigated";
    if (issue.lifecycle === "resolved") return "resolved";
    return "active";
  }

  protected badgeVariant(lifecycle: string): BadgeVariant {
    switch (lifecycle) {
      case "active":
        return "destructive";
      case "mitigated":
        return "outline";
      case "resolved":
        return "secondary";
      default:
        return "default";
    }
  }

  protected countdown(issue: IssueSnapshot): string {
    const activatedAt = issue.activated_at_pt_ms ?? 0;
    const deadline = activatedAt + issue.auto_resolve_pt_ms;
    const remaining = Math.max(0, deadline - this.playTimeMs());
    return formatTimeMs(remaining);
  }
}
