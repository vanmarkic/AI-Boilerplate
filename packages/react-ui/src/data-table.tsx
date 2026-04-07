import { type ReactNode, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';

export interface DataTableColumn<T> {
  accessor: keyof T & string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  clickableRows?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  clickableRows = false,
  onRowClick,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tanstackColumns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.accessor,
        header: col.header,
        enableSorting: col.sortable ?? false,
        cell: col.cell
          ? ({ row }) => col.cell!(row.original)
          : ({ getValue }) => String(getValue() ?? ''),
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="data-table">
      <table className="data-table-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="data-table-header-row">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={
                    header.column.getCanSort()
                      ? 'data-table-header-cell data-table-header-cell-sortable'
                      : 'data-table-header-cell'
                  }
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="data-table-header-cell-content">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <span
                        className="data-table-sort-icon"
                        data-active={header.column.getIsSorted() ? 'true' : undefined}
                        data-direction={header.column.getIsSorted() || undefined}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 15 12 9 18 15" />
                        </svg>
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="data-table-row"
              data-clickable={clickableRows || undefined}
              onClick={clickableRows ? () => onRowClick?.(row.original) : undefined}
              onKeyDown={
                clickableRows
                  ? (e) => {
                      if (e.key === 'Enter') onRowClick?.(row.original);
                    }
                  : undefined
              }
              tabIndex={clickableRows ? 0 : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="data-table-cell">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
