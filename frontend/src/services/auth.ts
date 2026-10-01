/**
 * Authentication client.
 *
 * Signup and login call the Spring Boot `auth` module at `/auth/*`. The session
 * it returns (profile plus bearer token) is kept in web storage, and the token
 * is attached to workspace requests by `services/api.ts`.
 *
 * The token lives in web storage, which is readable by any script on the page,
 * so this is only as strong as the app's XSS posture. An HttpOnly Secure
 * SameSite cookie would remove the token from JS entirely and is the right
 * end state; it needs the API and the client to share a domain or agree on
 * cross-site credentials, so it is deliberately deferred rather than half-done.
 *
 * The forms branch on `AuthError.code`, never on the message text: the same
 * email-and-password failure comes back for an unknown account, a wrong
 * password, and a deactivated one, so the client must not try to tell them
 * apart either.
 */

import { apiBase } from '../config';
import type { AuthErrorCode } from '../types';

const SESSION_KEY = 'logicraft.auth.session.v1';
const API_BASE = apiBase();

const hasStorage: boolean = (() => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem('__probe', '1');
    window.localStorage.removeItem('__probe');
    return true;
  } catch {
    return false;
  }
})();

const persistent = (): Storage | null => (hasStorage ? window.localStorage : null);
const scoped = (): Storage | null => (hasStorage ? window.sessionStorage : null);

/** The session shape kept in web storage. */
export interface Session {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  /** Bearer token to send with workspace requests. */
  token: string;
  startedAt: string;
}

/** The subset of the server's AuthResponse this client reads. */
interface AuthApiResponse {
  token?: string;
  tokenType?: string;
  id?: string;
  username?: string;
  email?: string;
  name?: string;
  company?: string;
  role?: string;
  error?: string;
  code?: string;
}

export const DEMO_ACCOUNT = { email: 'demo@logicraft.io', password: 'LogiCraft2026' };

/** Fields accepted by `signUp`. */
export interface SignUpInput {
  name: string;
  email: string;
  company: string;
  role: string;
  password: string;
}

/** Fields accepted by `signIn`. */
export interface SignInInput {
  email: string;
  password: string;
  remember?: boolean;
}

/** An `Error` carrying a machine-readable `code`, which the forms branch on. */
export type AuthError = Error & { code: AuthErrorCode };

function authError(message: string, code: AuthErrorCode): AuthError {
  const error = new Error(message) as AuthError;
  error.code = code;
  return error;
}

/** POSTs JSON to the auth API and normalises every failure to an `AuthError`. */
async function post(path: string, body: unknown): Promise<AuthApiResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw authError('Cannot reach the LogiCraft API. Is the backend running?', 'unavailable');
  }

  const type = response.headers.get('content-type') ?? '';
  const isJson = type.includes('json');

  // A response that is not JSON never came from this API's controllers, and the
  // three cases need different fixes, so they must not share a message:
  //   * 401/403 with no body — the security filter refused the request, which
  //     means the server has no /auth endpoint (an older deployment);
  //   * 5xx — a dev proxy with no backend behind it, or the API itself failing;
  //   * 2xx HTML — a static host rewriting every path to index.html, so
  //     VITE_API_BASE points at the wrong place.
  if (!isJson && (response.status === 401 || response.status === 403)) {
    throw authError(
      `POST ${API_BASE}${path} came back ${response.status} with no body, so the request never reached the auth controller. Either the API at ${API_BASE} is older than this client, or that path is not permitted.`,
      'unavailable'
    );
  }

  if (!isJson && response.status >= 500) {
    throw authError(
      `The auth API at ${API_BASE} failed with status ${response.status}. Is the backend running?`,
      'unavailable'
    );
  }

  if (!isJson && response.ok) {
    const kind = (type.split(';')[0] || 'an unknown content type').trim();
    throw authError(
      `${API_BASE}${path} answered with ${kind}, not JSON, so it is not the LogiCraft API. Check VITE_API_BASE.`,
      'unavailable'
    );
  }

  const payload = (isJson ? await response.json().catch(() => ({})) : {}) as AuthApiResponse;
  if (!response.ok) {
    const message = typeof payload.error === 'string' && payload.error
      ? payload.error
      : response.status === 409
        ? 'An account with that email already exists.'
        : response.status === 401
          ? 'That email and password combination does not match an account.'
          : `The auth request failed with status ${response.status}.`;

    throw authError(
      message,
      response.status === 409
        ? 'duplicate-email'
        : response.status === 401
          ? 'invalid-credentials'
          : 'request-failed'
    );
  }

  if (!payload.token) {
    throw authError('The auth service returned an unexpected response.', 'request-failed');
  }
  return payload;
}

function toSession(payload: AuthApiResponse): Session {
  return {
    id: payload.id ?? payload.username ?? '',
    name: payload.name ?? payload.username ?? '',
    email: payload.email ?? '',
    company: payload.company ?? '',
    role: payload.role ?? '',
    token: payload.token ?? '',
    startedAt: new Date().toISOString()
  };
}

function startSession(session: Session, remember: boolean): Session {
  const target = remember ? persistent() : scoped();
  const other = remember ? scoped() : persistent();
  if (target) target.setItem(SESSION_KEY, JSON.stringify(session));
  if (other) other.removeItem(SESSION_KEY);
  return session;
}

/**
 * Creates an account on the server, then keeps the returned session.
 *
 * Throws an `AuthError` with a `code` of 'duplicate-email', 'request-failed' or
 * 'unavailable', so the form can tell an existing account from an unreachable
 * API without parsing message strings.
 */
export async function signUp({ name, email, company, role, password }: SignUpInput): Promise<Session> {
  const payload = await post('/auth/signup', {
    name: name.trim(),
    email: email.trim(),
    company: company.trim(),
    role,
    password
  });
  return startSession(toSession(payload), true);
}

/**
 * Exchanges credentials for a session. A wrong password, an unknown email and a
 * deactivated account all come back as 'invalid-credentials'.
 */
export async function signIn({ email, password, remember = true }: SignInInput): Promise<Session> {
  const payload = await post('/auth/login', { email: email.trim(), password });
  return startSession(toSession(payload), remember);
}

export function signOut(): void {
  persistent()?.removeItem(SESSION_KEY);
  scoped()?.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  for (const store of [persistent(), scoped()]) {
    if (!store) continue;
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<Session> | null;
      // A session with no bearer token is a leftover from the pre-API build,
      // which kept accounts in localStorage. Treat it as signed out: otherwise
      // it shadows /login and opens the workspace to an unauthenticated user.
      if (!parsed || typeof parsed.token !== 'string' || parsed.token.length === 0) continue;
      return parsed as Session;
    } catch {
      /* fall through to the next store */
    }
  }
  return null;
}

/** The bearer token for workspace requests, or null when signed out. */
export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function hasSession(): boolean {
  return getSession() !== null;
}
