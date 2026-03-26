import { useCallback, useEffect, useState } from 'react';
import { Button, DataTable, DialogPanel, type DataTableColumn } from '@aspect/react-ui';
import { api } from '../../core/api';
import type { PermissionMapping } from '../../core/api.types';
import { PermissionForm, type PermissionFormValue } from './permission-form';

const columns: DataTableColumn<PermissionMapping>[] = [
  { accessor: 'role', header: 'Role', sortable: true },
  { accessor: 'route_pattern', header: 'Route Pattern', sortable: true },
  { accessor: 'method', header: 'Method', sortable: true },
  { accessor: 'frontend_route', header: 'Frontend Route' },
];

export default function PermissionsTab() {
  const [permissions, setPermissions] = useState<PermissionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PermissionMapping | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPermissions(await api.listPermissions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRowClick = (row: PermissionMapping) => {
    setEditing(row);
    setShowDialog(true);
  };

  const handleSubmit = async (value: PermissionFormValue) => {
    if (editing) {
      await api.updatePermission(editing.id, value);
    } else {
      await api.createPermission(value);
    }
    await api.reloadPermissionCache();
    setShowDialog(false);
    setEditing(null);
    await load();
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditing(null);
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowDialog(true); }}>
          Add Permission
        </Button>
      </div>
      <DataTable
        data={permissions}
        columns={columns}
        clickableRows
        onRowClick={handleRowClick}
      />
      {showDialog && (
        <DialogPanel
          title={<span>{editing ? 'Edit Permission' : 'Add Permission'}</span>}
          onClose={handleClose}
        >
          <PermissionForm
            permission={editing}
            onSubmit={(v) => void handleSubmit(v)}
            onCancel={handleClose}
          />
        </DialogPanel>
      )}
    </div>
  );
}
