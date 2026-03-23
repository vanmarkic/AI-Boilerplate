import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from "@angular/core";
import { ButtonDirective, BadgeComponent } from "@aspect/ui";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  options?: string[];
  readOnlyAfterCreate?: boolean;
}

@Component({
  selector: "tfc-foundation-catalog-section",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, BadgeComponent],
  template: `
    <h3 class="text-lg font-semibold">{{ title() }} ({{ items().length }})</h3>

    @for (item of items(); track item[idField()]) {
      <div
        class="flex flex-col gap-xs p-sm border-b"
        [id]="sectionId() + '-' + item[idField()]"
      >
        @if (editingId() === item[idField()]) {
          <div class="flex flex-col gap-xs">
            @for (field of fields(); track field.key) {
              @if (field.type === "checkbox") {
                <label class="flex items-center gap-xs text-sm">
                  <input
                    type="checkbox"
                    [checked]="!!editDraft()[field.key]"
                    [disabled]="
                      field.readOnlyAfterCreate === true && !isNewItem()
                    "
                    (change)="setDraftField(field.key, isChecked($event))"
                  />
                  {{ field.label }}
                </label>
              } @else if (field.type === "textarea") {
                <div class="flex flex-col gap-xs">
                  <label class="text-xs">{{ field.label }}</label>
                  <textarea
                    class="input-base"
                    [value]="editDraft()[field.key] ?? ''"
                    [disabled]="
                      field.readOnlyAfterCreate === true && !isNewItem()
                    "
                    (input)="setDraftField(field.key, inputVal($event))"
                  ></textarea>
                </div>
              } @else if (field.type === "select") {
                <div class="flex flex-col gap-xs">
                  <label class="text-xs">{{ field.label }}</label>
                  <select
                    class="input-base"
                    [value]="editDraft()[field.key] ?? ''"
                    [disabled]="
                      field.readOnlyAfterCreate === true && !isNewItem()
                    "
                    (change)="setDraftField(field.key, selectVal($event))"
                  >
                    @for (opt of field.options ?? []; track opt) {
                      <option [value]="opt">{{ opt }}</option>
                    }
                  </select>
                </div>
              } @else {
                <div class="flex flex-col gap-xs">
                  <label class="text-xs">{{ field.label }}</label>
                  <input
                    type="text"
                    class="input-base"
                    [value]="editDraft()[field.key] ?? ''"
                    [disabled]="
                      field.readOnlyAfterCreate === true && !isNewItem()
                    "
                    (input)="setDraftField(field.key, inputVal($event))"
                  />
                </div>
              }
            }
            <div class="flex gap-sm">
              <button uiButton variant="default" size="sm" (click)="saveEdit()">
                Save
              </button>
              <button
                uiButton
                variant="outline"
                size="sm"
                (click)="cancelEdit()"
              >
                Cancel
              </button>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-xs">
              <ui-badge variant="secondary">{{ item[idField()] }}</ui-badge>
              <span class="text-sm font-medium">{{ item[labelField()] }}</span>
            </div>
            <div class="flex gap-xs">
              <button
                uiButton
                variant="outline"
                size="sm"
                (click)="startEdit(item)"
              >
                Edit
              </button>
              <button
                uiButton
                variant="destructive"
                size="sm"
                (click)="remove(asString(item[idField()]))"
              >
                Remove
              </button>
            </div>
          </div>
        }
      </div>
    } @empty {
      <p class="text-muted-foreground text-sm p-sm">No items yet.</p>
    }

    @if (addingNew()) {
      <div class="flex flex-col gap-xs p-sm border-t">
        @for (field of fields(); track field.key) {
          @if (field.type === "checkbox") {
            <label class="flex items-center gap-xs text-sm">
              <input
                type="checkbox"
                [checked]="!!addDraft()[field.key]"
                (change)="setAddField(field.key, isChecked($event))"
              />
              {{ field.label }}
            </label>
          } @else if (field.type === "textarea") {
            <div class="flex flex-col gap-xs">
              <label class="text-xs">{{ field.label }}</label>
              <textarea
                class="input-base"
                [value]="addDraft()[field.key] ?? ''"
                (input)="setAddField(field.key, inputVal($event))"
              ></textarea>
            </div>
          } @else if (field.type === "select") {
            <div class="flex flex-col gap-xs">
              <label class="text-xs">{{ field.label }}</label>
              <select
                class="input-base"
                [value]="addDraft()[field.key] ?? ''"
                (change)="setAddField(field.key, selectVal($event))"
              >
                @for (opt of field.options ?? []; track opt) {
                  <option [value]="opt">{{ opt }}</option>
                }
              </select>
            </div>
          } @else {
            <div class="flex flex-col gap-xs">
              <label class="text-xs">{{ field.label }}</label>
              <input
                type="text"
                class="input-base"
                [value]="addDraft()[field.key] ?? ''"
                (input)="setAddField(field.key, inputVal($event))"
              />
            </div>
          }
        }
        <div class="flex gap-sm">
          <button uiButton variant="default" size="sm" (click)="confirmAdd()">
            Add
          </button>
          <button
            uiButton
            variant="outline"
            size="sm"
            (click)="addingNew.set(false)"
          >
            Cancel
          </button>
        </div>
      </div>
    } @else {
      <div class="p-sm border-t">
        <button uiButton variant="outline" size="sm" (click)="startAdd()">
          + Add {{ title() }}
        </button>
      </div>
    }
  `,
})
export class FoundationCatalogSectionComponent {
  readonly title = input.required<string>();
  readonly sectionId = input.required<string>();
  readonly items = input.required<Record<string, unknown>[]>();
  readonly fields = input.required<FieldDef[]>();
  readonly idField = input<string>("id");
  readonly labelField = input<string>("label");

  readonly onAdd = output<Record<string, unknown>>();
  readonly onUpdate = output<{
    id: string;
    updates: Record<string, unknown>;
  }>();
  readonly onRemove = output<string>();

  protected readonly editingId = signal<string | null>(null);
  protected readonly editDraft = signal<Record<string, unknown>>({});
  protected readonly addingNew = signal(false);
  protected readonly addDraft = signal<Record<string, unknown>>({});
  protected readonly isNewItem = signal(false);

  protected asString(value: unknown): string {
    return String(value ?? "");
  }

  protected inputVal(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLInputElement) return target.value;
    if (target instanceof HTMLTextAreaElement) return target.value;
    return "";
  }

  protected selectVal(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return target.value;
    return "";
  }

  protected isChecked(event: Event): boolean {
    const target = event.target;
    if (target instanceof HTMLInputElement) return target.checked;
    return false;
  }

  protected setDraftField(key: string, value: unknown): void {
    this.editDraft.set({ ...this.editDraft(), [key]: value });
  }

  protected setAddField(key: string, value: unknown): void {
    this.addDraft.set({ ...this.addDraft(), [key]: value });
  }

  protected startEdit(item: Record<string, unknown>): void {
    this.editingId.set(this.asString(item[this.idField()]));
    this.editDraft.set({ ...item });
    this.isNewItem.set(false);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft.set({});
  }

  protected saveEdit(): void {
    const id = this.editingId();
    if (!id) return;
    const draft = this.editDraft();
    const updates: Record<string, unknown> = {};
    for (const field of this.fields()) {
      updates[field.key] = draft[field.key];
    }
    this.onUpdate.emit({ id, updates });
    this.editingId.set(null);
    this.editDraft.set({});
  }

  protected startAdd(): void {
    const draft: Record<string, unknown> = {};
    for (const field of this.fields()) {
      if (field.type === "checkbox") {
        draft[field.key] = false;
      } else if (field.type === "select" && field.options?.length) {
        draft[field.key] = field.options[0];
      } else {
        draft[field.key] = "";
      }
    }
    this.addDraft.set(draft);
    this.addingNew.set(true);
  }

  protected confirmAdd(): void {
    const draft = this.addDraft();
    const idVal = this.asString(draft[this.idField()]).trim();
    if (!idVal) return;
    this.onAdd.emit({ ...draft });
    this.addingNew.set(false);
    this.addDraft.set({});
  }

  protected remove(id: string): void {
    this.onRemove.emit(id);
  }
}
