import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";
import { BadgeComponent, ButtonDirective } from "@aspect/ui";
import { DomainService } from "../../core/domain.service";
import { formatTimeMs } from "../../core/format-time";
import type {
  EventSnapshot,
  IssueSnapshot,
} from "../../core/engine-api.service";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

@Component({
  selector: "tfc-gm-details-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective],
  template: `
    @if (selectedEvent(); as event) {
      <div class="details-panel">
        <div class="details-panel__header">
          <h3 class="details-panel__title">{{ event.title }}</h3>
          <ui-badge [variant]="eventBadgeVariant()">{{ event.lifecycle }}</ui-badge>
        </div>
        <p class="details-panel__description">{{ event.description }}</p>

        <div class="details-panel__grid">
          <div class="details-panel__field">
            <span class="details-panel__label">Type</span>
            <span class="details-panel__value">{{ event.event_type }}</span>
          </div>
          <div class="details-panel__field">
            <span class="details-panel__label">Execution Mode</span>
            <span class="details-panel__value">{{ event.execution_mode }}</span>
          </div>
          <div class="details-panel__field">
            <span class="details-panel__label">Scheduled</span>
            <span class="details-panel__value font-mono">{{ formatMs(event.scheduled_pt_ms) }}</span>
          </div>
          <div class="details-panel__field">
            <span class="details-panel__label">Duration</span>
            <span class="details-panel__value font-mono">{{ event.duration_ms !== null ? formatMs(event.duration_ms) : "N/A" }}</span>
          </div>
          <div class="details-panel__field">
            <span class="details-panel__label">Lifecycle</span>
            <span class="details-panel__value">{{ event.lifecycle }}</span>
          </div>
          @if (event.started_at_pt_ms !== null) {
            <div class="details-panel__field">
              <span class="details-panel__label">Started At</span>
              <span class="details-panel__value font-mono">{{ formatMs(event.started_at_pt_ms) }}</span>
            </div>
          }
          @if (event.completed_at_pt_ms !== null) {
            <div class="details-panel__field">
              <span class="details-panel__label">Completed At</span>
              <span class="details-panel__value font-mono">{{ formatMs(event.completed_at_pt_ms) }}</span>
            </div>
          }
        </div>

        @if (event.dependencies.length > 0) {
          <div class="details-panel__section">
            <span class="details-panel__label">Dependencies</span>
            <div class="details-panel__tags">
              @for (dep of event.dependencies; track dep) {
                <ui-badge variant="outline">{{ dep }}</ui-badge>
              }
            </div>
          </div>
        }
        @if (event.triggered_issues.length > 0) {
          <div class="details-panel__section">
            <span class="details-panel__label">Triggered {{ domain.term("issue") }}s</span>
            <div class="details-panel__tags">
              @for (issueId of event.triggered_issues; track issueId) {
                <ui-badge variant="secondary">{{ issueId }}</ui-badge>
              }
            </div>
          </div>
        }
        @if (event.target_roles.length > 0) {
          <div class="details-panel__section">
            <span class="details-panel__label">Target Roles</span>
            <div class="details-panel__tags">
              @for (role of event.target_roles; track role) {
                <ui-badge variant="default">{{ role }}</ui-badge>
              }
            </div>
          </div>
        }
        @if (roleDescriptionEntries().length > 0) {
          <div class="details-panel__section">
            <span class="details-panel__label">Role Descriptions</span>
            @for (entry of roleDescriptionEntries(); track entry.role) {
              <div class="details-panel__role-desc">
                <span class="details-panel__role-name">{{ entry.role }}</span>
                <span class="details-panel__role-text">{{ entry.description }}</span>
              </div>
            }
          </div>
        }

        <div class="details-panel__actions">
          @if (canPauseEvent()) {
            <button uiButton variant="outline" size="sm" (click)="pauseEvent.emit(event.id)">Pause</button>
          }
          @if (canResumeEvent()) {
            <button uiButton variant="default" size="sm" (click)="resumeEvent.emit(event.id)">Resume</button>
          }
          @if (canCancelEvent()) {
            <button uiButton variant="destructive" size="sm" (click)="cancelEvent.emit(event.id)">Cancel</button>
          }
          @if (canCompleteEvent()) {
            <button uiButton variant="outline" size="sm" (click)="completeEvent.emit(event.id)">Complete</button>
          }
        </div>
      </div>
    } @else if (selectedIssue(); as issue) {
      <div class="details-panel">
        <div class="details-panel__header">
          <h3 class="details-panel__title">{{ issue.title }}</h3>
          <ui-badge [variant]="issueBadgeVariant()">{{ issue.lifecycle }}</ui-badge>
        </div>
        <p class="details-panel__description">{{ issue.description }}</p>

        <div class="details-panel__grid">
          <div class="details-panel__field">
            <span class="details-panel__label">Trigger Mode</span>
            <span class="details-panel__value">{{ issue.trigger_mode }}</span>
          </div>
          <div class="details-panel__field">
            <span class="details-panel__label">Lifecycle</span>
            <span class="details-panel__value">{{ issue.lifecycle }}</span>
          </div>
          @if (issue.auto_resolve_pt_ms > 0) {
            <div class="details-panel__field">
              <span class="details-panel__label">Auto-Resolve (PT)</span>
              <span class="details-panel__value font-mono">{{ formatMs(issue.auto_resolve_pt_ms) }}</span>
            </div>
          }
          @if (issue.auto_resolve_rt_ms > 0) {
            <div class="details-panel__field">
              <span class="details-panel__label">Auto-Resolve (RT)</span>
              <span class="details-panel__value font-mono">{{ formatMs(issue.auto_resolve_rt_ms) }}</span>
            </div>
          }
          @if (issue.activated_at_pt_ms !== null) {
            <div class="details-panel__field">
              <span class="details-panel__label">Activated At (PT)</span>
              <span class="details-panel__value font-mono">{{ formatMs(issue.activated_at_pt_ms) }}</span>
            </div>
          }
          @if (issue.activated_at_rt_ms !== null) {
            <div class="details-panel__field">
              <span class="details-panel__label">Activated At (RT)</span>
              <span class="details-panel__value font-mono">{{ formatMs(issue.activated_at_rt_ms) }}</span>
            </div>
          }
          @if (issue.resolved_at_pt_ms !== null) {
            <div class="details-panel__field">
              <span class="details-panel__label">Resolved At</span>
              <span class="details-panel__value font-mono">{{ formatMs(issue.resolved_at_pt_ms) }}</span>
            </div>
          }
          <div class="details-panel__field">
            <span class="details-panel__label">Released</span>
            <span class="details-panel__value">{{ issue.released ? "Yes" : "No" }}</span>
          </div>
        </div>

        <div class="details-panel__actions">
          @if (canActivateIssue()) {
            <button uiButton variant="default" size="sm" (click)="activateIssue.emit(issue.id)">Activate</button>
          }
          @if (canMitigateIssue()) {
            <button uiButton variant="outline" size="sm" (click)="mitigateIssue.emit(issue.id)">Mitigate</button>
          }
          @if (canResolveIssue()) {
            <button uiButton variant="outline" size="sm" (click)="resolveIssue.emit(issue.id)">Resolve</button>
          }
        </div>
      </div>
    } @else {
      <p class="details-panel__empty">
        Select an {{ domain.term("event") }} or {{ domain.term("issue") }} to view details.
      </p>
    }
  `,
  host: { class: "gm-details-panel" },
})
export class GmDetailsPanelComponent {
  protected readonly domain = inject(DomainService);

  readonly selectedEvent = input<EventSnapshot | null>(null);
  readonly selectedIssue = input<IssueSnapshot | null>(null);

  readonly pauseEvent = output<string>();
  readonly resumeEvent = output<string>();
  readonly cancelEvent = output<string>();
  readonly completeEvent = output<string>();
  readonly activateIssue = output<string>();
  readonly mitigateIssue = output<string>();
  readonly resolveIssue = output<string>();

  protected readonly roleDescriptionEntries = computed(() => {
    const event = this.selectedEvent();
    if (!event) return [];
    return Object.entries(event.role_descriptions).map(
      ([role, description]) => ({ role, description }),
    );
  });

  protected readonly canPauseEvent = computed(() => this.selectedEvent()?.lifecycle === "running");
  protected readonly canResumeEvent = computed(() => this.selectedEvent()?.lifecycle === "paused");
  protected readonly canCompleteEvent = computed(() => this.selectedEvent()?.lifecycle === "running");
  protected readonly canCancelEvent = computed(() => {
    const lc = this.selectedEvent()?.lifecycle;
    return lc !== undefined && lc !== "completed" && lc !== "cancelled";
  });

  protected readonly canActivateIssue = computed(() => this.selectedIssue()?.lifecycle === "inactive");
  protected readonly canMitigateIssue = computed(() => this.selectedIssue()?.lifecycle === "active");
  protected readonly canResolveIssue = computed(() => {
    const lc = this.selectedIssue()?.lifecycle;
    return lc === "active" || lc === "mitigated";
  });

  protected eventBadgeVariant(): BadgeVariant {
    const lc = this.selectedEvent()?.lifecycle;
    if (lc === "running") return "default";
    if (lc === "completed") return "secondary";
    if (lc === "cancelled") return "destructive";
    return "outline";
  }

  protected issueBadgeVariant(): BadgeVariant {
    const lc = this.selectedIssue()?.lifecycle;
    if (lc === "active") return "destructive";
    if (lc === "mitigated") return "outline";
    return "secondary";
  }

  protected formatMs(ms: number): string {
    return formatTimeMs(ms);
  }
}
