'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage, login } from '../../lib/api';
import { getApiBaseUrl } from '../../lib/runtime-config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/catalog');
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-block auth-brand">
          <span className="brand-mark">A</span>
          <div>
            <p className="brand-name">ARATI</p>
            <p className="brand-caption">Business ERP</p>
          </div>
        </div>

        <p className="eyebrow">Sign in</p>
        <h1>Operator console</h1>
        <p className="lead">
          Catalogue changes made here flow to the Arati Refrigeration storefront.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@arati.local"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-note">API: {getApiBaseUrl()}</p>
      </section>
    </main>
  );
}
