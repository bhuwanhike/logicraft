import { useId, useState } from 'react';
import type { FocusEventHandler } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { scorePassword } from './auth.constants';

/**
 * Password input with a visibility toggle, and — on signup only — a strength
 * read-out. The toggle is a plain button rather than a checkbox so it can sit
 * inside the field without disturbing the label and error alignment.
 */
/** Props for {@link PasswordField}. */
export interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  showStrength?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  placeholder = 'Enter your password',
  showStrength = false
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const describedBy = useId();
  const strength = showStrength ? scorePassword(value) : null;

  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>

      <div className="auth-input-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[
            showStrength ? describedBy : null,
            error ? `${id}-error` : null
          ]
            .filter(Boolean)
            .join(' ') || undefined}
        />
        <button
          className="auth-reveal"
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {showStrength && strength && (
        <div className="auth-strength" id={describedBy}>
          <div className="auth-strength-track" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <i key={step} className={strength.score >= step ? `is-on level-${strength.score}` : ''} />
            ))}
          </div>
          <span>
            {value ? `Password strength: ${strength.label}` : 'Use 8+ characters with a number and a symbol'}
          </span>
        </div>
      )}

      {error && (
        <p className="auth-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
