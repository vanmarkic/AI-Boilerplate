import { useState, type FormEvent } from 'react';
import { Input, FormError, Button } from '@aspect/react-ui';
import { api } from '../core/api';

interface FormState {
  name: string;
  email: string;
}

export default function Register() {
  const [form, setForm] = useState<FormState>({ name: '', email: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors: Record<string, Record<string, true>> = {};
  if (!form.name.trim()) errors.name = { required: true };
  if (!form.email.trim()) errors.email = { required: true };
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = { email: true };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true });
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.createUser({ name: form.name, email: form.email });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-md p-xl" style={{ minHeight: '100vh' }}>
        <h2 className="text-2xl font-bold">Registration successful!</h2>
        <p className="text-muted-foreground">You can now log in.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-lg p-xl" style={{ minHeight: '100vh' }}>
      <h1 className="text-3xl font-bold">Register</h1>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-sm" style={{ width: '100%', maxWidth: '24rem' }}>
        <Input
          label="Name"
          value={form.name}
          onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        <FormError errors={errors.name} touched={touched.name} />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onValueChange={(v) => setForm((f) => ({ ...f, email: v }))}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
        <FormError errors={errors.email} touched={touched.email} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Registering…' : 'Register'}
        </Button>
      </form>
    </div>
  );
}
