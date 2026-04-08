import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";
import { BadgeComponent } from "@aspect/ui";
import type { IssueSnapshot } from "../../core/engine-api.service";
import { formatTimeMs } from "../../core/format-time";

type LifecycleGroup = "active" | "mitigated" | "resolved" | "inactive";

const LIFECYCLE_ORDER: LifecycleGroup[] = [
  "active",
  "mitigated",
  "resolved",
  "inactive",
];

interface GroupedIssues {
  label: LifecycleGroup;
  items: IssueSnapshot[];
}

function lifecycleGroup(lifecycle: string): LifecycleGroup {
  if (lifecycle === "active") return "active";
  if (lifecycle === "mitigated") return "mitigated";
  if (lifecycle === "resolved") return "resolved";
  return "inactive";
}

@Component({
  selector: "tfc-gm-defect-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="defect-list">
      <h3 class="defect-list__title">Defects</h3>
      @for (group of grouped(); track group.label) {
        @if (group.items.length > 0) {
          <div class="defect-list__group">
            <span class="defect-list__group-label">{{ group.label }}</span>
            @for (issue of group.items; track issue.id) {
              <button
                class="defect-list__item"
                [attr.data-lifecycle]="issue.lifecycle"
                (click)="issueSelected.emit(issue.id)"
              >
                <span class="defect-list__item-title">{{ issue.title }}</span>
                <span class="defect-list__item-meta">
                  <ui-badge
                    [variant]="badgeVariant(issue.lifecycle)"
                    >{{ issue.lifecycle }}</ui-badge
                  >
                  @if (
                    issue.lifecycle === "active" &&
                    (issue.auto_resolve_pt_ms > 0 || issue.auto_resolve_rt_ms > 0)
                  ) {
                    <span class="defect-list__countdown">{{
                      countdown(issue)
                    }}</span>
                  }
                </span>
              </button>
            }
          </div>
        }
      }
      @if (issues().length === 0) {
        <p class="defect-list__empty">No defects loaded.</p>
      }
    </div>
  `,
  host: { class: "gm-defect-list" },
})
export class GmDefectListComponent {
  readonly issues = input<IssueSnapshot[]>([]);
  readonly playTimeMs = input(0);
  readonly realTimeMs = input(0);
  readonly issueSelected = output<string>();

  protected readonly grouped = computed<GroupedIssues[]>(() => {
    const issues = this.issues();
    const buckets = new Map<LifecycleGroup, IssueSnapshot[]>();
    for (const group of LIFECYCLE_ORDER) {
      buckets.set(group, []);
    }
    for (const issue of issues) {
      const key = lifecycleGroup(issue.lifecycle);
      buckets.get(key)!.push(issue);
    }
    return LIFECYCLE_ORDER.map((label) => ({
      label,
      items: buckets.get(label) ?? [],
    }));
  });

  protected badgeVariant(
    lifecycle: string,
  ): "default" | "secondary" | "destructive" | "outline" {
    switch (lifecycle) {
      case "active":
        return "destructive";
      case "mitigated":
        return "outline";
      case "resolved":
        return "secondary";
      default:
        return "secondary";
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
