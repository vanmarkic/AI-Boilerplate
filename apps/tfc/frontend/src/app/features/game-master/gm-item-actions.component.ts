import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BadgeComponent, ButtonDirective, CardComponent } from '@aspect/ui';
import type { InjectSnapshot, DefectSnapshot } from '../../core/engine-api.service';

@Component({
  selector: 'tfc-gm-item-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective, CardComponent],
  template: `
    <ui-card title="Injects">
      @for (inject of injects(); track inject.id) {
        <div class="flex items-center justify-between p-sm border-b">
          <div>
            <span class="text-sm font-medium">{{ inject.title }}</span>
            <span class="text-xs text-muted-foreground ml-sm">{{ inject.lifecycle }}</span>
          </div>
          <div class="flex gap-xs">
            @if (inject.lifecycle === 'scheduled' || inject.lifecycle === 'pending') {
              <button uiButton variant="outline" size="sm"
                (click)="triggerInject.emit(inject.id)">Trigger</button>
            }
            @if (inject.lifecycle === 'running') {
              <button uiButton variant="outline" size="sm"
                (click)="completeInject.emit(inject.id)">Complete</button>
            }
            @if (inject.lifecycle !== 'completed' && inject.lifecycle !== 'cancelled') {
              <button uiButton variant="destructive" size="sm"
                (click)="cancelInject.emit(inject.id)">Cancel</button>
            }
          </div>
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No injects loaded.</p>
      }
    </ui-card>

    <ui-card title="Defects">
      @for (defect of defects(); track defect.id) {
        <div class="flex items-center justify-between p-sm border-b">
          <div>
            <span class="text-sm font-medium">{{ defect.title }}</span>
            <ui-badge [variant]="defect.lifecycle === 'active' ? 'destructive' : 'secondary'">
              {{ defect.lifecycle }}
            </ui-badge>
          </div>
          <div class="flex gap-xs">
            @if (defect.lifecycle === 'inactive') {
              <button uiButton variant="outline" size="sm"
                (click)="activateDefect.emit(defect.id)">Activate</button>
            }
            @if (defect.lifecycle === 'active') {
              <button uiButton variant="outline" size="sm"
                (click)="mitigateDefect.emit(defect.id)">Mitigate</button>
              <button uiButton variant="outline" size="sm"
                (click)="resolveDefect.emit(defect.id)">Resolve</button>
            }
            @if (defect.lifecycle === 'mitigated') {
              <button uiButton variant="outline" size="sm"
                (click)="resolveDefect.emit(defect.id)">Resolve</button>
            }
          </div>
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No defects loaded.</p>
      }
    </ui-card>
  `,
})
export class GmItemActionsComponent {
  readonly injects = input<InjectSnapshot[]>([]);
  readonly defects = input<DefectSnapshot[]>([]);

  readonly triggerInject = output<string>();
  readonly completeInject = output<string>();
  readonly cancelInject = output<string>();
  readonly activateDefect = output<string>();
  readonly mitigateDefect = output<string>();
  readonly resolveDefect = output<string>();
}
