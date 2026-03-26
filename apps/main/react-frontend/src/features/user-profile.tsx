import { useEffect, useState } from 'react';
import { api } from '../core/api';
import type { User } from '../core/api.types';

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getUser(1).then(
      (data) => { setUser(data); setLoading(false); },
      (err) => { setError(err instanceof Error ? err.message : 'Failed'); setLoading(false); },
    );
  }, []);

  if (loading) return <div className="p-lg text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-lg form-error">{error}</div>;
  if (!user) return null;

  return (
    <div className="p-lg flex flex-col gap-md" style={{ maxWidth: '32rem' }}>
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="card">
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p className="text-sm text-muted-foreground">Member since {new Date(user.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
