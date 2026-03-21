import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { BadgeComponent } from "@aspect/ui";

export interface SidebarSection {
  id: string;
  label: string;
  count: number;
}

@Component({
  selector: "tfc-scenario-sidebar-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <nav class="flex flex-col gap-xs p-sm" style="position: sticky; top: 0">
      @for (section of sections(); track section.id) {
        <a
          class="flex items-center justify-between p-xs rounded text-sm cursor-pointer"
          [class.font-medium]="activeSection() === section.id"
          [style.background-color]="activeSection() === section.id ? 'var(--color-muted)' : 'transparent'"
          (click)="onSectionClick(section.id)"
        >
          {{ section.label }}
          <ui-badge variant="secondary">{{ section.count }}</ui-badge>
        </a>
      }
    </nav>
  `,
})
export class ScenarioSidebarNavComponent {
  readonly sections = input.required<SidebarSection[]>();
  readonly activeSection = input<string>("");
  readonly sectionClick = output<string>();

  protected onSectionClick(sectionId: string): void {
    this.sectionClick.emit(sectionId);
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
