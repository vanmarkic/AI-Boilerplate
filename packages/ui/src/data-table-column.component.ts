import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  ViewChild,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkColumnDef, CdkTableModule } from '@angular/cdk/table';

import type { ColumnAlign, SortDirection } from './data-table.types';

@Component({
  selector: 'ui-data-table-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTableModule, NgTemplateOutlet],
  template: `
    <ng-container [cdkColumnDef]="columnDef()">
      <th
        cdk-header-cell
        *cdkHeaderCellDef
        class="data-table-header-cell"
        [class.data-table-header-cell-sortable]="sortable()"
        [attr.data-align]="align()"
        (click)="sortable() ? onSort() : null"
      >
        <span class="data-table-header-cell-content">
          {{ label() || columnDef() }}
          @if (sortable()) {
            <svg
              class="data-table-sort-icon"
              [attr.data-active]="activeSortDir() !== null"
              [attr.data-direction]="activeSortDir()"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 15 12 9 18 15" />
            </svg>
            @if (sortIdx() !== null && sortIdx()! >= 0) {
              <span class="data-table-sort-badge">{{ sortIdx()! + 1 }}</span>
            }
          }
        </span>
      </th>
      <td
        cdk-cell
        *cdkCellDef="let element"
        class="data-table-cell"
        [attr.data-align]="align()"
      >
        @if (cellTemplate) {
          <ng-container
            [ngTemplateOutlet]="cellTemplate"
            [ngTemplateOutletContext]="{ $implicit: element, value: element[columnDef()] }"
          />
        } @else {
          {{ element[columnDef()] }}
        }
      </td>
    </ng-container>
  `,
})
export class DataTableColumnComponent {
  readonly columnDef = input.required<string>();
  readonly label = input<string>('');
  readonly sortable = input(false);
  readonly align = input<ColumnAlign>('start');

  readonly activeSortDir = signal<SortDirection | null>(null);
  readonly sortIdx = signal<number | null>(null);

  @ViewChild(CdkColumnDef, { static: true }) column!: CdkColumnDef;
  @ContentChild('cell', { static: false }) cellTemplate?: TemplateRef<unknown>;

  sortCallback?: (columnDef: string) => void;

  onSort(): void {
    this.sortCallback?.(this.columnDef());
  }
}
