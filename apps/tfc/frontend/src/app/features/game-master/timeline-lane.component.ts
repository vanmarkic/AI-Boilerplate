import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { TimelineItem, TimeScale } from './timeline-utils';

@Component({
  selector: 'tfc-timeline-lane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline-lane">
      @for (item of items(); track item.id) {
        <div class="timeline-bar"
          [attr.data-lifecycle]="item.lifecycle"
          [style.left.px]="item.startMs * scale().pxPerMs"
          [style.width.px]="barWidth(item)"
          [style.top.px]="item.lane * 32"
          [title]="item.label + ' (' + item.lifecycle + ')'"
          (click)="itemSelected.emit(item.id)">
          {{ item.label }}
        </div>
      }
    </div>
  `,
  host: {
    class: 'timeline-lane-host',
    '[style.height.px]': 'laneHeight()',
  },
})
export class TimelineLaneComponent {
  readonly items = input<TimelineItem[]>([]);
  readonly scale = input.required<TimeScale>();
  readonly itemSelected = output<string>();

  protected readonly laneHeight = computed(() => {
    const maxLane = this.items().reduce((max, i) => Math.max(max, i.lane), 0);
    return (maxLane + 1) * 32 + 4;
  });

  protected barWidth(item: TimelineItem): number {
    const width = (item.endMs - item.startMs) * this.scale().pxPerMs;
    return Math.max(width, 4);
  }
}
