import { useState, useMemo } from 'react';
import { DialogPanel, Badge, Button } from '@aspect/react-ui';
import { useAuth } from '../../core/auth-context';
import type { KeycloakUser, KeycloakRole } from '../../core/api.types';

const PROTECTED_ROLES = new Set(['admin', 'role_manager']);

interface Props {
  user: KeycloakUser;
  allRoles: KeycloakRole[];
  onClose: () => void;
  onSave: (added: string[], removed: string[]) => void;
}

export function UserRolesDialog({ user, allRoles, onClose, onSave }: Props) {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.roles.includes('admin') ?? false;

  const originalRoles = useMemo(
    () => new Set(user.roles.map((r) => r.name)),
    [user],
  );
  const [selected, setSelected] = useState(() => new Set(originalRoles));

  const hasChanges = useMemo(() => {
    if (selected.size !== originalRoles.size) return true;
    for (const r of selected) if (!originalRoles.has(r)) return true;
    return false;
  }, [selected, originalRoles]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSave = () => {
    const added = [...selected].filter((r) => !originalRoles.has(r));
    const removed = [...originalRoles].filter((r) => !selected.has(r));
    onSave(added, removed);
  };

  return (
    <DialogPanel
      title={<span>Roles for {user.username}</span>}
      onClose={onClose}
      footer={
        <div className="flex gap-sm justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!hasChanges}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-sm">
        {allRoles.map((role) => {
          const isProtected = PROTECTED_ROLES.has(role.name);
          return (
            <label key={role.name} className="flex items-center gap-sm">
              <input
                type="checkbox"
                checked={selected.has(role.name)}
                onChange={() => toggle(role.name)}
                disabled={isProtected && !isAdmin}
              />
              <span>{role.name}</span>
              {isProtected && <Badge variant="secondary">protected</Badge>}
            </label>
          );
        })}
      </div>
    </DialogPanel>
  );
}
