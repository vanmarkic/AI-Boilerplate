import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { BadgeComponent, ButtonDirective, CardComponent } from '@aspect/ui';
import { DomainService } from '../../core/domain.service';
import type { EventSnapshot, IssueSnapshot } from '../../core/engine-api.service';

@Component({
  selector: 'tfc-gm-item-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective, CardComponent],
  template: `
    <ui-card [title]="domain.term('event') + 's'">
      @for (event of events(); track event.id) {
        <div class="flex items-center justify-between p-sm border-b">
          <div>
            <span class="text-sm font-medium">{{ event.title }}</span>
            <span class="text-xs text-muted-foreground ml-sm">{{ event.lifecycle }}</span>
          </div>
          <div class="flex gap-xs">
            @if (event.lifecycle === 'scheduled' || event.lifecycle === 'pending') {
              <button uiButton variant="outline" size="sm"
                (click)="triggerEvent.emit(event.id)">Trigger</button>
            }
            @if (event.lifecycle === 'running') {
              <button uiButton variant="outline" size="sm"
                (click)="completeEvent.emit(event.id)">Complete</button>
            }
            @if (event.lifecycle !== 'completed' && event.lifecycle !== 'cancelled') {
              <button uiButton variant="destructive" size="sm"
                (click)="cancelEvent.emit(event.id)">Cancel</button>
            }
          </div>
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No events loaded.</p>
      }
    </ui-card>

    <ui-card [title]="domain.term('issue') + 's'">
      @for (issue of issues(); track issue.id) {
        <div class="flex items-center justify-between p-sm border-b">
          <div>
            <span class="text-sm font-medium">{{ issue.title }}</span>
            <ui-badge [variant]="issue.lifecycle === 'active' ? 'destructive' : 'secondary'">
              {{ issue.lifecycle }}
            </ui-badge>
          </div>
          <div class="flex gap-xs">
            @if (issue.lifecycle === 'inactive') {
              <button uiButton variant="outline" size="sm"
                (click)="activateIssue.emit(issue.id)">Activate</button>
            }
            @if (issue.lifecycle === 'active') {
              <button uiButton variant="outline" size="sm"
                (click)="mitigateIssue.emit(issue.id)">Mitigate</button>
              <button uiButton variant="outline" size="sm"
                (click)="resolveIssue.emit(issue.id)">Resolve</button>
            }
            @if (issue.lifecycle === 'mitigated') {
              <button uiButton variant="outline" size="sm"
                (click)="resolveIssue.emit(issue.id)">Resolve</button>
            }
          </div>
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No issues loaded.</p>
      }
    </ui-card>
  `,
})
export class GmItemActionsComponent {
  protected readonly domain = inject(DomainService);

  readonly events = input<EventSnapshot[]>([]);
  readonly issues = input<IssueSnapshot[]>([]);

  readonly triggerEvent = output<string>();
  readonly completeEvent = output<string>();
  readonly cancelEvent = output<string>();
  readonly activateIssue = output<string>();
  readonly mitigateIssue = output<string>();
  readonly resolveIssue = output<string>();
}
