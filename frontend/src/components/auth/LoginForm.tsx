import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, FormAlert, SubmitButton, useAuthForm } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { validateLogin } from './auth.constants';
import type { LoginValues } from './auth.constants';
import { DEMO_ACCOUNT, signIn } from '../../services/auth';

const INITIAL: LoginValues = { email: '', password: '' };

export function LoginPage() {
  const navigate = useNavigate();
  const form = useAuthForm(INITIAL);
  const [remember, setRemember] = useState<boolean>(true);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit(validateLogin, async (values) => {
      await signIn({ ...values, remember });
      navigate('/dashboard', { replace: true });
    });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your LogiCraft workspace."
      footer={
        <>
          New to LogiCraft? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <FormAlert message={form.submitError} />

        <div className={`auth-field ${form.errors.email ? 'has-error' : ''}`}>
          <label htmlFor="login-email">Work email</label>
          <div className="auth-input-wrap">
            <input
              id="login-email"
              type="email"
              value={form.values.email}
              onChange={(event) => form.set('email')(event.target.value)}
              onBlur={form.blur('email')}
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={form.errors.email ? 'true' : undefined}
              aria-describedby={form.errors.email ? 'login-email-error' : undefined}
            />
          </div>
          {form.errors.email && (
            <p className="auth-error" id="login-email-error" role="alert">
              {form.errors.email}
            </p>
          )}
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          value={form.values.password}
          onChange={form.set('password')}
          onBlur={form.blur('password')}
          error={form.errors.password}
          autoComplete="current-password"
        />

        <div className="auth-row">
          <label className="auth-check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Keep me signed in</span>
          </label>
          <span className="auth-disabled-hint" title="Available once the auth service is connected">
            Forgot password?
          </span>
        </div>

        <SubmitButton busy={form.busy}>Sign in</SubmitButton>
      </form>

      <div className="auth-demo">
        <b>Demo access</b>
        <span>
          {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
        </span>
        <button
          type="button"
          onClick={() => {
            form.set('email')(DEMO_ACCOUNT.email);
            form.set('password')(DEMO_ACCOUNT.password);
          }}
        >
          Fill in
        </button>
      </div>
    </AuthLayout>
  );
}
