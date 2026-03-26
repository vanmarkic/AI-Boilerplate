import { useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  CollapsiblePanel,
  DialogPanel,
  Input,
  FormError,
} from '@aspect/react-ui';
import { useAuth } from '../../core/auth-context';
import type { KeycloakRole } from '../../core/api.types';

const UNDELETABLE_ROLES = new Set(['admin', 'role_manager', 'user']);

interface Props {
  roles: KeycloakRole[];
  onCreate: (name: string, description: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export function RolesManagement({ roles, onCreate, onDelete }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError =
    !name.trim()
      ? { required: true as const }
      : !/^[a-z][a-z0-9_]*$/.test(name)
        ? { pattern: true as const }
        : undefined;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameError) return;
    await onCreate(name, description);
    setName('');
    setDescription('');
    setTouched(false);
    setShowCreate(false);
  };

  return (
    <CollapsiblePanel header="Roles" variant="outline">
      <div className="flex flex-col gap-sm p-sm">
        {roles.map((role) => (
          <div key={role.name} className="flex items-center justify-between gap-sm">
            <div className="flex items-center gap-sm">
              <span>{role.name}</span>
              {UNDELETABLE_ROLES.has(role.name) && (
                <Badge variant="secondary">system</Badge>
              )}
            </div>
            {isAdmin && !UNDELETABLE_ROLES.has(role.name) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void onDelete(role.name)}
              >
                Delete
              </Button>
            )}
          </div>
        ))}
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            Create Role
          </Button>
        )}
      </div>
      {showCreate && (
        <DialogPanel
          title={<span>Create Role</span>}
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-sm">
            <Input label="Name" value={name} onValueChange={setName} onBlur={() => setTouched(true)} />
            <FormError errors={nameError} touched={touched} />
            <Input label="Description" value={description} onValueChange={setDescription} />
            <div className="flex justify-end gap-sm">
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogPanel>
      )}
    </CollapsiblePanel>
  );
}
