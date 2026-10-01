import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, FormAlert, SubmitButton, useAuthForm } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { AUTH_ROLES, passwordChecks, validateSignup } from './auth.constants';
import type { FieldErrors, SignupValues } from './auth.constants';
import { signUp } from '../../services/auth';

const INITIAL: SignupValues = { name: '', email: '', company: '', role: '', password: '', confirmPassword: '' };

export function SignupPage() {
  const navigate = useNavigate();
  const form = useAuthForm(INITIAL);
  const [terms, setTerms] = useState<boolean>(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit(
      (values) => validateSignup(values, terms),
      async (values) => {
        await signUp(values);
        navigate('/dashboard', { replace: true });
      }
    );
  };

  const checks = passwordChecks(form.values.password);

  // The terms checkbox is deliberately held in its own state rather than in
  // `values`, so the validator's 'terms' key sits outside the form's shape.
  const termsError = (form.errors as FieldErrors<'terms'>).terms;

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start unifying your logistics operations in a few minutes."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <FormAlert message={form.submitError} />

        <div className="auth-grid">
          <div className={`auth-field ${form.errors.name ? 'has-error' : ''}`}>
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              value={form.values.name}
              onChange={(event) => form.set('name')(event.target.value)}
              onBlur={form.blur('name')}
              autoComplete="name"
              placeholder="Alex Moreau"
              aria-invalid={form.errors.name ? 'true' : undefined}
            />
            {form.errors.name && <p className="auth-error" role="alert">{form.errors.name}</p>}
          </div>

          <div className={`auth-field ${form.errors.company ? 'has-error' : ''}`}>
            <label htmlFor="signup-company">Company</label>
            <input
              id="signup-company"
              value={form.values.company}
              onChange={(event) => form.set('company')(event.target.value)}
              onBlur={form.blur('company')}
              autoComplete="organization"
              placeholder="Northstar Freight"
              aria-invalid={form.errors.company ? 'true' : undefined}
            />
            {form.errors.company && <p className="auth-error" role="alert">{form.errors.company}</p>}
          </div>
        </div>

        <div className={`auth-field ${form.errors.email ? 'has-error' : ''}`}>
          <label htmlFor="signup-email">Work email</label>
          <input
            id="signup-email"
            type="email"
            value={form.values.email}
            onChange={(event) => form.set('email')(event.target.value)}
            onBlur={form.blur('email')}
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={form.errors.email ? 'true' : undefined}
          />
          {form.errors.email && <p className="auth-error" role="alert">{form.errors.email}</p>}
        </div>

        <div className={`auth-field ${form.errors.role ? 'has-error' : ''}`}>
          <label htmlFor="signup-role">Primary role</label>
          <div className="auth-select-wrap">
            <select
              id="signup-role"
              value={form.values.role}
              onChange={(event) => form.set('role')(event.target.value)}
              onBlur={form.blur('role')}
              aria-invalid={form.errors.role ? 'true' : undefined}
            >
              <option value="">Select a role</option>
              {AUTH_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          {form.errors.role && <p className="auth-error" role="alert">{form.errors.role}</p>}
        </div>

        <PasswordField
          id="signup-password"
          label="Password"
          value={form.values.password}
          onChange={form.set('password')}
          onBlur={form.blur('password')}
          error={form.errors.password}
          autoComplete="new-password"
          showStrength
        />

        {form.values.password && (
          <ul className="auth-checks">
            {checks.map((check) => (
              <li key={check.label} className={check.met ? 'is-met' : ''}>
                {check.label}
              </li>
            ))}
          </ul>
        )}

        <PasswordField
          id="signup-confirm"
          label="Confirm password"
          value={form.values.confirmPassword}
          onChange={form.set('confirmPassword')}
          onBlur={form.blur('confirmPassword')}
          error={form.errors.confirmPassword}
          autoComplete="new-password"
        />

        <div className={`auth-check auth-check-block ${termsError ? 'has-error' : ''}`}>
          <label>
            <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
            <span>I agree to the Terms of Service and Privacy Policy.</span>
          </label>
          {termsError && <p className="auth-error" role="alert">{termsError}</p>}
        </div>

        <SubmitButton busy={form.busy}>Create account</SubmitButton>
      </form>
    </AuthLayout>
  );
}
