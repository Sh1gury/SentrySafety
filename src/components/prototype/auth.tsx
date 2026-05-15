'use client';

import { useState } from 'react';
import { Logo } from './shared';
import type { Page } from './types';

interface AuthPageProps {
  mode: 'login' | 'register';
  onSwitch: (mode: Page) => void;
  onSubmit: (email: string) => void;
}

export function AuthPage({ mode, onSwitch, onSubmit }: AuthPageProps) {
  const [email, setEmail] = useState(mode === 'login' ? 'demo@sentry.io' : '');
  const [password, setPassword] = useState(mode === 'login' ? 'demodemo' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSubmit(email);
    }, 700);
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Logo size="lg" />
        <div className="auth-title">{isRegister ? 'Create your account' : 'Sign in to SentrySafety'}</div>
        <div className="auth-sub">
          {isRegister
            ? 'Secure your AI pipeline today. PII never leaves your server.'
            : 'Enter your credentials to access the console.'}
        </div>

        <div className="form-group">
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <div className="label-row">
            <label className="label">Password</label>
            {!isRegister && (
              <a style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>Forgot?</a>
            )}
          </div>
          <input
            type="password"
            className="input"
            placeholder={isRegister ? 'Minimum 6 characters' : '••••••••'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          {error && <div className="form-error">{error}</div>}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          disabled={loading}
        >
          {loading ? 'Connecting…' : (isRegister ? 'Create account' : 'Sign in →')}
        </button>

        <div className="divider">OR</div>

        <button
          type="button"
          className="btn"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => { setEmail('demo@sentry.io'); setTimeout(() => onSubmit('demo@sentry.io'), 200); }}
        >
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>G</span>
          <span>Continue with Google</span>
        </button>

        <div className="auth-link">
          {isRegister ? (
            <>Already have an account? <a onClick={() => onSwitch('login')}>Sign in</a></>
          ) : (
            <>No account? <a onClick={() => onSwitch('register')}>Create one</a></>
          )}
        </div>
      </form>

      <div className="auth-footer">
        <span className="accent-mini">⬡</span> YOUR PII NEVER LEAVES YOUR SERVER &nbsp;·&nbsp; SOC 2 TYPE II &nbsp;·&nbsp; GDPR-READY
      </div>
    </div>
  );
}
