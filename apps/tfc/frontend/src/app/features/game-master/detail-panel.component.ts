import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BadgeComponent, ButtonDirective, CollapsiblePanelComponent } from '@aspect/ui';
import type { InjectSnapshot, DefectSnapshot } from '../../core/engine-api.service';
import { formatTimeMs } from '../../core/format-time';

@Component({
  selector: 'tfc-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective, CollapsiblePanelComponent],
  template: `
    <ui-collapsible-panel>
      <span panelTitle>Details</span>

      @if (inject(); as inj) {
        <div class="detail-panel__content">
          <div class="detail-panel__row">
            <span class="detail-panel__label">Title</span>
            <span class="detail-panel__value">{{ inj.title }}</span>
          </div>
          @if (inj.description) {
            <div class="detail-panel__row">
              <span class="detail-panel__label">Description</span>
              <span class="detail-panel__value text-muted-foreground">{{ inj.description }}</span>
            </div>
          }
          <div class="detail-panel__row">
            <span class="detail-panel__label">Type</span>
            <ui-badge variant="secondary">{{ inj.inject_type }}</ui-badge>
          </div>
          <div class="detail-panel__row">
            <span class="detail-panel__label">Execution</span>
            <ui-badge [variant]="inj.execution_mode === 'manual' ? 'destructive' : 'default'">
              {{ inj.execution_mode }}
            </ui-badge>
          </div>
          <div class="detail-panel__row">
            <span class="detail-panel__label">Lifecycle</span>
            <ui-badge variant="secondary">{{ inj.lifecycle }}</ui-badge>
          </div>
          <div class="detail-panel__row">
            <span class="detail-panel__label">Scheduled</span>
            <span class="detail-panel__value">{{ fmtMs(inj.scheduled_pt_ms) }}</span>
          </div>
          @if (inj.duration_ms !== null) {
            <div class="detail-panel__row">
              <span class="detail-panel__label">Duration</span>
              <span class="detail-panel__value">{{ fmtMs(inj.duration_ms) }}</span>
            </div>
          }
          @if (inj.dependencies.length > 0) {
            <div class="detail-panel__row">
              <span class="detail-panel__label">Dependencies</span>
              <span class="detail-panel__value">{{ inj.dependencies.join(', ') }}</span>
            </div>
          }
          <div class="detail-panel__actions">
            @if (inj.lifecycle === 'scheduled' || inj.lifecycle === 'pending') {
              <button uiButton variant="default" size="sm"
                (click)="triggerInject.emit(inj.id)">Trigger</button>
            }
            @if (inj.lifecycle === 'running') {
              <button uiButton variant="outline" size="sm"
                (click)="pauseInject.emit(inj.id)">Pause</button>
              <button uiButton variant="outline" size="sm"
                (click)="completeInject.emit(inj.id)">Complete</button>
            }
            @if (inj.lifecycle === 'paused') {
              <button uiButton variant="outline" size="sm"
                (click)="resumeInject.emit(inj.id)">Resume</button>
            }
            @if (inj.lifecycle !== 'completed' && inj.lifecycle !== 'cancelled') {
              <button uiButton variant="destructive" size="sm"
                (click)="cancelInject.emit(inj.id)">Cancel</button>
            }
          </div>
        </div>
      } @else if (defect(); as def) {
        <div class="detail-panel__content">
          <div class="detail-panel__row">
            <span class="detail-panel__label">Title</span>
            <span class="detail-panel__value">{{ def.title }}</span>
          </div>
          @if (def.description) {
            <div class="detail-panel__row">
              <span class="detail-panel__label">Description</span>
              <span class="detail-panel__value text-muted-foreground">{{ def.description }}</span>
            </div>
          }
          <div class="detail-panel__row">
            <span class="detail-panel__label">Trigger Mode</span>
            <ui-badge variant="secondary">{{ def.trigger_mode }}</ui-badge>
          </div>
          <div class="detail-panel__row">
            <span class="detail-panel__label">Lifecycle</span>
            <ui-badge [variant]="def.lifecycle === 'active' ? 'destructive' : 'secondary'">
              {{ def.lifecycle }}
            </ui-badge>
          </div>
          @if (def.auto_resolve_pt_ms > 0) {
            <div class="detail-panel__row">
              <span class="detail-panel__label">ETBOL (PT)</span>
              <span class="detail-panel__value">{{ fmtMs(def.auto_resolve_pt_ms) }}</span>
            </div>
            <div class="detail-panel__row">
              <span class="detail-panel__label">ETBOL (RT)</span>
              <span class="detail-panel__value">{{ fmtMs(def.auto_resolve_rt_ms) }}</span>
            </div>
          }
          <div class="detail-panel__actions">
            @if (def.lifecycle === 'inactive') {
              <button uiButton variant="outline" size="sm"
                (click)="activateDefect.emit(def.id)">Activate</button>
            }
            @if (def.lifecycle === 'active') {
              <button uiButton variant="outline" size="sm"
                (click)="mitigateDefect.emit(def.id)">Mitigate</button>
              <button uiButton variant="outline" size="sm"
                (click)="resolveDefect.emit(def.id)">Resolve</button>
            }
            @if (def.lifecycle === 'mitigated') {
              <button uiButton variant="outline" size="sm"
                (click)="resolveDefect.emit(def.id)">Resolve</button>
            }
          </div>
        </div>
      } @else {
        <p class="text-muted-foreground text-sm p-sm">
          Select an inject or defect to view details.
        </p>
      }
    </ui-collapsible-panel>
  `,
})
export class DetailPanelComponent {
  readonly inject = input<InjectSnapshot | null>(null);
  readonly defect = input<DefectSnapshot | null>(null);

  readonly triggerInject = output<string>();
  readonly cancelInject = output<string>();
  readonly completeInject = output<string>();
  readonly pauseInject = output<string>();
  readonly resumeInject = output<string>();

  readonly activateDefect = output<string>();
  readonly mitigateDefect = output<string>();
  readonly resolveDefect = output<string>();

  protected fmtMs(ms: number): string {
    return formatTimeMs(ms);
  }
}
