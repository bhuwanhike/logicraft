import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { AUTH_PANEL } from './auth.constants';
import type { FieldErrors } from './auth.constants';

/** Field names of a form's value shape. */
type FieldName<T> = Extract<keyof T, string>;

/** Props for {@link AuthLayout}. */
export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared chrome for both auth pages: the brand panel that carries the product
 * story, and the form column. Only one is shown on narrow screens, where the
 * panel collapses to a header strip — the form is the reason for the visit.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <Link className="auth-logo" to="/">
            <BrandLogo />
            <b>
              LogiCraft
              <small>LOGISTICS OS</small>
            </b>
          </Link>

          <div className="auth-brand-copy">
            <h2>{AUTH_PANEL.headline}</h2>
            <p>{AUTH_PANEL.body}</p>
            <ul>
              {AUTH_PANEL.points.map((point) => (
                <li key={point}>
                  <Check size={15} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <p className="auth-brand-foot">
            <ShieldCheck size={14} aria-hidden="true" />
            Development build — accounts are stored in this browser only.
          </p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-head">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
          {footer && <div className="auth-switch">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** Props for {@link SubmitButton}. */
export interface SubmitButtonProps {
  busy: boolean;
  children: ReactNode;
}

export function SubmitButton({ busy, children }: SubmitButtonProps) {
  return (
    <button className="auth-submit" type="submit" disabled={busy}>
      {busy ? (
        <>
          <span className="auth-spinner" aria-hidden="true" />
          Please wait
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={15} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

/** Props for {@link FormAlert}. */
export interface FormAlertProps {
  message: string;
}

export function FormAlert({ message }: FormAlertProps) {
  if (!message) return null;
  return (
    <p className="auth-alert" role="alert">
      {message}
    </p>
  );
}

/** The handle {@link useAuthForm} returns for a given value shape. */
export interface AuthForm<T> {
  values: T;
  errors: FieldErrors<FieldName<T>>;
  touched: Partial<Record<FieldName<T>, boolean>>;
  submitError: string;
  busy: boolean;
  set: <K extends FieldName<T>>(field: K) => (value: T[K]) => void;
  blur: (field: FieldName<T>) => () => void;
  handleSubmit: (
    validate: (values: T) => FieldErrors<FieldName<T>>,
    submit: (values: T) => Promise<void>
  ) => Promise<void>;
  setSubmitError: (message: string) => void;
}

export function useAuthForm<T>(initialValues: T): AuthForm<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<FieldName<T>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName<T>, boolean>>>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const set = <K extends FieldName<T>>(field: K) => (value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }) as T);
    // Clear a field's error as soon as it is edited — leaving it on while the
    // user fixes the value reads as the form still being broken.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setSubmitError('');
  };

  const blur = (field: FieldName<T>) => () =>
    setTouched((prev) => ({ ...prev, [field]: true }) as Partial<Record<FieldName<T>, boolean>>);

  /**
   * @param validate field name to message; an empty object means valid.
   * @param submit  performs the request once validation passes.
   */
  const handleSubmit = async (
    validate: (values: T) => FieldErrors<FieldName<T>>,
    submit: (values: T) => Promise<void>
  ) => {
    setSubmitError('');
    const found = validate(values);
    setErrors(found);
    setTouched(
      Object.keys(values as object).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Partial<Record<FieldName<T>, boolean>>
      )
    );

    if (Object.keys(found).length > 0) {
      const first = document.querySelector<HTMLInputElement | HTMLSelectElement>(
        '.auth-field.has-error input, .auth-field.has-error select'
      );
      first?.focus();
      return;
    }

    setBusy(true);
    try {
      await submit(values);
    } catch (error) {
      setSubmitError(
        (error instanceof Error ? error.message : '') || 'Something went wrong. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return { values, errors, touched, submitError, busy, set, blur, handleSubmit, setSubmitError };
}
