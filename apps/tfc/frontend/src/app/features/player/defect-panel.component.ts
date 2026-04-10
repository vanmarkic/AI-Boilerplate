import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import type { IssueSnapshot } from "../../core/generated/state-changes.types";
import { formatTimeMs } from "../../core/format-time";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

@Component({
  selector: "tfc-defect-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective],
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
        @if (issue.auto_resolve_pt_ms > 0 || issue.auto_resolve_rt_ms > 0) {
          <div class="defect-panel__countdown">
            ETBOL {{ countdown(issue) }}
          </div>
        }
        @if (issue.lifecycle === 'active') {
          <button
            uiButton
            variant="outline"
            size="sm"
            class="defect-panel__mitigate-btn"
            (click)="mitigated.emit(issue.id)"
          >
            Report Mitigation
          </button>
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
  readonly realTimeMs = input(0);
  readonly mitigated = output<string>();

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
    const ptRemaining =
      issue.auto_resolve_pt_ms > 0
        ? (issue.activated_at_pt_ms ?? 0) +
          issue.auto_resolve_pt_ms -
          this.playTimeMs()
        : Infinity;
    const rtRemaining =
      issue.auto_resolve_rt_ms > 0
        ? (issue.activated_at_rt_ms ?? 0) +
          issue.auto_resolve_rt_ms -
          this.realTimeMs()
        : Infinity;
    return formatTimeMs(Math.max(0, Math.min(ptRemaining, rtRemaining)));
  }
}
