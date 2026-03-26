import { useState, type FormEvent } from 'react';
import { Button } from '@aspect/react-ui';

const stack = [
  'Angular 21',
  'FastAPI',
  'PostgreSQL',
  'Keycloak',
  'Docker',
  'Playwright',
];

export default function Landing() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-xl p-xl" style={{ minHeight: '100vh' }}>
      <span className="badge" data-variant="secondary">v0.1.0</span>
      <h1 className="text-4xl font-bold text-center">Boilerplate</h1>
      <p className="text-muted-foreground text-center" style={{ maxWidth: '36rem' }}>
        Production-grade full-stack starter with enterprise auth, design system, and automated testing.
      </p>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex gap-sm" style={{ width: '100%', maxWidth: '24rem' }}>
          <input
            className="input-base"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" size="lg">Get Started</Button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-sm">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-muted-foreground">Thanks! We'll be in touch.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-sm justify-center">
        {stack.map((tech) => (
          <span key={tech} className="badge" data-variant="outline">{tech}</span>
        ))}
      </div>
    </div>
  );
}
