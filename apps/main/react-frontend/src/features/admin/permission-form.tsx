import { useState, useEffect, type FormEvent } from 'react';
import { Input, FormError, Button } from '@aspect/react-ui';
import type { PermissionMapping } from '../../core/api.types';

export interface PermissionFormValue {
  role: string;
  route_pattern: string;
  method: string;
  frontend_route: string;
}

interface Props {
  permission?: PermissionMapping | null;
  onSubmit: (value: PermissionFormValue) => void;
  onCancel: () => void;
}

export function PermissionForm({ permission, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<PermissionFormValue>({
    role: '',
    route_pattern: '',
    method: '',
    frontend_route: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (permission) {
      setForm({
        role: permission.role,
        route_pattern: permission.route_pattern,
        method: permission.method,
        frontend_route: permission.frontend_route ?? '',
      });
    }
  }, [permission]);

  const errors: Record<string, Record<string, true>> = {};
  if (!form.role.trim()) errors.role = { required: true };
  if (!form.route_pattern.trim()) errors.route_pattern = { required: true };
  if (!form.method.trim()) errors.method = { required: true };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ role: true, route_pattern: true, method: true });
    if (Object.keys(errors).length > 0) return;
    onSubmit(form);
  };

  const set = (key: keyof PermissionFormValue) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));
  const touch = (key: string) => () =>
    setTouched((t) => ({ ...t, [key]: true }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-sm">
      <Input label="Role" value={form.role} onValueChange={set('role')} onBlur={touch('role')} />
      <FormError errors={errors.role} touched={touched.role} />
      <Input label="Route Pattern" value={form.route_pattern} onValueChange={set('route_pattern')} onBlur={touch('route_pattern')} />
      <FormError errors={errors.route_pattern} touched={touched.route_pattern} />
      <Input label="Method" value={form.method} onValueChange={set('method')} onBlur={touch('method')} />
      <FormError errors={errors.method} touched={touched.method} />
      <Input label="Frontend Route" value={form.frontend_route} onValueChange={set('frontend_route')} />
      <div className="flex justify-end gap-sm">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{permission ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}
