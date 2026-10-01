/**
 * Copy, field definitions and validation for the login and signup pages.
 *
 * The rules live here rather than in the forms so both pages agree on what a
 * valid account is, and so the wording can be reviewed without opening a
 * component.
 */

/** Password strength as shown next to the field. */
export interface PasswordScore {
  score: number;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
}

/** A single requirement in the signup checklist. */
export interface PasswordCheck {
  label: string;
  met: boolean;
}

/** Field name to message. An empty object means the values are valid. */
export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

/** The values the signup form validates. */
export interface SignupValues {
  name: string;
  email: string;
  company: string;
  role: string;
  password: string;
  confirmPassword: string;
}

/** The values the login form validates. */
export interface LoginValues {
  email: string;
  password: string;
}

export const AUTH_ROLES: string[] = [
  'Operations Manager',
  'Dispatcher',
  'Fleet Supervisor',
  'Warehouse Lead',
  'Data Analyst'
];

export const AUTH_PANEL: {
  headline: string;
  body: string;
  points: string[];
} = {
  headline: 'One control tower for every shipment, vehicle and warehouse.',
  body: 'Sign in to the workspace where incidents are detected, triaged and resolved before they cascade.',
  points: [
    'Live fleet, shipment and warehouse state in one view',
    'Severity-based alert routing, not notification noise',
    'Role-scoped access for dispatchers, drivers and analysts'
  ]
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function scorePassword(password: string): PasswordScore {
  if (!password) return { score: 0, label: 'Too short' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;

  if (password.length < 8) return { score: 0, label: 'Too short' };
  if (score <= 2) return { score: 1, label: 'Weak' };
  if (score === 3) return { score: 2, label: 'Fair' };
  if (score === 4) return { score: 3, label: 'Good' };
  return { score: 4, label: 'Strong' };
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Upper and lower case', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'A symbol', met: /[^\w\s]/.test(password) }
  ];
}

/**
 * @returns field name to message. Empty object means valid.
 */
export function validateSignup(
  values: SignupValues,
  acceptedTerms: boolean
): FieldErrors<keyof SignupValues | 'terms'> {
  const errors: FieldErrors<keyof SignupValues | 'terms'> = {};

  if (!values.name.trim()) errors.name = 'Enter your full name.';
  else if (values.name.trim().length < 2) errors.name = 'That name looks too short.';

  if (!values.email.trim()) errors.email = 'Enter your work email.';
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.';

  if (!values.company.trim()) errors.company = 'Enter your company name.';
  else if (values.company.trim().length < 2) errors.company = 'Enter a valid company name.';

  if (!values.role) errors.role = 'Choose the role you will use most.';

  if (!values.password) errors.password = 'Choose a password.';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';

  if (!values.confirmPassword) errors.confirmPassword = 'Repeat your password.';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';

  if (!acceptedTerms) errors.terms = 'Accept the terms to create an account.';

  return errors;
}

export function validateLogin(values: LoginValues): FieldErrors<keyof LoginValues> {
  const errors: FieldErrors<keyof LoginValues> = {};

  if (!values.email.trim()) errors.email = 'Enter your email.';
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.';

  if (!values.password) errors.password = 'Enter your password.';

  return errors;
}
