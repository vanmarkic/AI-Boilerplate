import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  CardComponent,
  ButtonDirective,
  InputComponent,
  BadgeComponent,
} from "@aspect/ui";
import type { ScenarioEventDef } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-event-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CardComponent,
    ButtonDirective,
    InputComponent,
    BadgeComponent,
  ],
  template: `
    <ui-card title="Events">
      @for (event of store.content().events; track event.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          @if (editingId() === event.id) {
            <div class="flex flex-col gap-xs">
              <ui-input
                id="edit-evt-title"
                label="Title"
                [value]="editTitle()"
                (valueChange)="editTitle.set($event)"
              />
              <ui-input
                id="edit-evt-desc"
                label="Description"
                [value]="editDesc()"
                (valueChange)="editDesc.set($event)"
              />
              <div class="flex gap-sm">
                <div class="flex flex-col gap-xs" style="flex:1">
                  <label class="text-xs">Type</label>
                  <select
                    class="input-base"
                    [value]="editType()"
                    (change)="editType.set(sel($event))"
                  >
                    <option value="informational">Informational</option>
                    <option value="operational">Operational</option>
                    <option value="decision">Decision</option>
                  </select>
                </div>
                <ui-input
                  id="edit-evt-pt"
                  label="PT (ms)"
                  [value]="'' + editPt()"
                  (valueChange)="editPt.set(+$event)"
                />
                <ui-input
                  id="edit-evt-dur"
                  label="Duration (ms)"
                  [value]="'' + (editDur() ?? '')"
                  (valueChange)="editDur.set($event ? +$event : null)"
                />
              </div>
              <div class="flex gap-sm">
                <button
                  uiButton
                  variant="default"
                  size="sm"
                  (click)="save(event.id)"
                >
                  Save
                </button>
                <button
                  uiButton
                  variant="outline"
                  size="sm"
                  (click)="editingId.set(null)"
                >
                  Cancel
                </button>
              </div>
            </div>
          } @else {
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ event.title }}</span>
                <ui-badge variant="secondary">{{ event.event_type }}</ui-badge>
                <span class="text-xs text-muted-foreground ml-sm">
                  @ {{ event.scheduled_pt_ms / 1000 }}s
                </span>
              </div>
              <div class="flex gap-xs">
                <button
                  uiButton
                  variant="outline"
                  size="sm"
                  (click)="edit(event)"
                >
                  Edit
                </button>
                <button
                  uiButton
                  variant="destructive"
                  size="sm"
                  (click)="store.removeEvent(event.id)"
                >
                  Remove
                </button>
              </div>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No events yet.</p>
      }
      <div class="flex gap-sm p-sm border-t">
        <ui-input
          id="event-title"
          label=""
          placeholder="Event title"
          [(value)]="newTitle"
        />
        <ui-input
          id="event-time"
          label=""
          placeholder="PT (ms)"
          [(value)]="newTime"
        />
        <select
          class="input-base"
          [value]="newType()"
          (change)="newType.set(sel($event))"
        >
          <option value="operational">Operational</option>
          <option value="informational">Informational</option>
          <option value="decision">Decision</option>
        </select>
        <button uiButton variant="outline" size="sm" (click)="add()">
          Add
        </button>
      </div>
    </ui-card>
  `,
})
export class ScenarioEventEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  private counter = 0;

  protected readonly newTitle = signal("");
  protected readonly newTime = signal("");
  protected readonly newType = signal("operational");

  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal("");
  protected readonly editDesc = signal("");
  protected readonly editType = signal("operational");
  protected readonly editPt = signal(0);
  protected readonly editDur = signal<number | null>(null);

  protected sel(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return target.value;
    return "";
  }

  protected add(): void {
    const title = this.newTitle().trim();
    const time = parseFloat(this.newTime()) || 0;
    if (!title) return;
    this.store.addEvent({
      id: `evt-${++this.counter}`,
      title,
      description: "",
      event_type: this.newType(),
      scheduled_pt_ms: time,
      duration_ms: null,
      dependencies: [],
      triggered_issues: [],
    });
    this.newTitle.set("");
    this.newTime.set("");
  }

  protected edit(event: ScenarioEventDef): void {
    this.editingId.set(event.id);
    this.editTitle.set(event.title);
    this.editDesc.set(event.description);
    this.editType.set(event.event_type);
    this.editPt.set(event.scheduled_pt_ms);
    this.editDur.set(event.duration_ms);
  }

  protected save(eventId: string): void {
    this.store.updateEvent(eventId, {
      title: this.editTitle(),
      description: this.editDesc(),
      event_type: this.editType(),
      scheduled_pt_ms: this.editPt(),
      duration_ms: this.editDur(),
    });
    this.editingId.set(null);
  }
}
