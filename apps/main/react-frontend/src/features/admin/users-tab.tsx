import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, DataTable, Input, type DataTableColumn } from '@aspect/react-ui';
import { api } from '../../core/api';
import type { KeycloakUser, KeycloakRole } from '../../core/api.types';
import { UserRolesDialog } from './user-roles-dialog';
import { RolesManagement } from './roles-management';

export default function UsersTab() {
  const [users, setUsers] = useState<KeycloakUser[]>([]);
  const [allRoles, setAllRoles] = useState<KeycloakRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<KeycloakUser | null>(null);

  const loadUsers = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await api.listUsers({ search: q, offset: 0, limit: 50 });
      setUsers(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      setAllRoles(await api.listRoles());
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadRoles();
  }, [loadUsers, loadRoles]);

  const handleSearch = (value: string) => {
    setSearch(value);
    void loadUsers(value || undefined);
  };

  const handleRolesChanged = async (added: string[], removed: string[]) => {
    if (!selectedUser) return;
    if (added.length > 0) await api.assignRoles(selectedUser.id, added);
    if (removed.length > 0) await api.removeRoles(selectedUser.id, removed);
    setSelectedUser(null);
    await loadUsers(search || undefined);
  };

  const columns: DataTableColumn<KeycloakUser>[] = [
    { accessor: 'username', header: 'Username' },
    { accessor: 'email', header: 'Email' },
    {
      accessor: 'enabled',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.enabled ? 'default' : 'destructive'}>
          {row.enabled ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      accessor: 'roles' as keyof KeycloakUser & string,
      header: 'Roles',
      cell: (row) => (
        <div className="flex flex-wrap gap-xs">
          {row.roles.map((r) => (
            <Badge
              key={r.name}
              variant={r.name === 'admin' ? 'default' : 'secondary'}
            >
              {r.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessor: 'id',
      header: '',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedUser(row)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <Input
        label="Search users"
        placeholder="Search by username or email"
        value={search}
        onValueChange={handleSearch}
      />
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <DataTable data={users} columns={columns} />
      )}
      <RolesManagement
        roles={allRoles}
        onCreate={async (name, desc) => {
          await api.createRole({ name, description: desc });
          await loadRoles();
        }}
        onDelete={async (name) => {
          await api.deleteRole(name);
          await loadRoles();
        }}
      />
      {selectedUser && (
        <UserRolesDialog
          user={selectedUser}
          allRoles={allRoles}
          onClose={() => setSelectedUser(null)}
          onSave={(added, removed) => void handleRolesChanged(added, removed)}
        />
      )}
    </div>
  );
}
