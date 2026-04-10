import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { BadgeComponent } from '@aspect/ui';
import { formatTimeMs } from '../../core/format-time';
import type { DefectSnapshot } from '../../core/engine-api.service';

type DefectWithCountdown = DefectSnapshot & { remaining_ms: number };

@Component({
  selector: 'tfc-defect-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="defect-panel">
      @if (activeDefects().length > 0) {
        <p class="defect-panel__section-label">Active</p>
        @for (defect of activeDefects(); track defect.id) {
          <div class="defect-panel__item defect-panel__item--active"
            (click)="toggleExpand(defect.id)"
            (keydown.enter)="toggleExpand(defect.id)"
            (keydown.space)="toggleExpand(defect.id)"
            tabindex="0"
            role="button"
            [attr.aria-expanded]="isExpanded(defect.id)">
            <div class="defect-panel__item-header">
              <span class="defect-panel__title">{{ defect.title }}</span>
              <ui-badge variant="destructive">{{ defect.lifecycle }}</ui-badge>
              @if (countdown(defect.id); as cd) {
                <span class="defect-panel__countdown">ETBOL {{ cd }}</span>
              }
            </div>
            @if (isExpanded(defect.id)) {
              <p class="defect-panel__description">{{ defect.description }}</p>
            }
          </div>
        }
      }

      @if (resolvedDefects().length > 0) {
        <p class="defect-panel__section-label">Resolved</p>
        @for (defect of resolvedDefects(); track defect.id) {
          <div class="defect-panel__item defect-panel__item--resolved"
            (click)="toggleExpand(defect.id)"
            (keydown.enter)="toggleExpand(defect.id)"
            (keydown.space)="toggleExpand(defect.id)"
            tabindex="0"
            role="button"
            [attr.aria-expanded]="isExpanded(defect.id)">
            <div class="defect-panel__item-header">
              <span class="defect-panel__title">{{ defect.title }}</span>
              <ui-badge variant="secondary">{{ defect.lifecycle }}</ui-badge>
            </div>
            @if (isExpanded(defect.id)) {
              <p class="defect-panel__description">{{ defect.description }}</p>
            }
          </div>
        }
      }

      @if (activeDefects().length === 0 && resolvedDefects().length === 0) {
        <p class="text-muted-foreground text-sm p-sm">No defects assigned yet.</p>
      }
    </div>
  `,
})
export class DefectPanelComponent {
  readonly defects = input.required<DefectSnapshot[]>();
  readonly countdowns = input.required<DefectWithCountdown[]>();

  protected readonly activeDefects = computed(() =>
    this.defects().filter((d) => d.lifecycle === 'active' || d.lifecycle === 'mitigated'),
  );

  protected readonly resolvedDefects = computed(() =>
    this.defects().filter((d) => d.lifecycle === 'resolved'),
  );

  private readonly expandedIds = signal<Set<string>>(new Set());

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected toggleExpand(id: string): void {
    const current = new Set(this.expandedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedIds.set(current);
  }

  protected countdown(defectId: string): string | null {
    const item = this.countdowns().find((c) => c.id === defectId);
    if (!item || item.remaining_ms <= 0) return null;
    return formatTimeMs(item.remaining_ms);
  }
}
