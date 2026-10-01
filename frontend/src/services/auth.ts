/**
 * Authentication client.
 *
 * IMPORTANT: there is no auth API yet — the Spring Boot `auth` module under
 * `backend/auth` is empty scaffolding — so this is a browser-only stand-in that
 * keeps accounts and a session in web storage. The password digest below is
 * plain obfuscation, not cryptography: it keeps a password out of devtools but
 * protects nothing, because the whole database is sitting in localStorage.
 *
 * Before this ships, delete the two ADAPTER functions at the bottom of this file
 * and re-point `signUp`/`signIn`/`signOut` at the server. Everything else — the
 * forms, the validation, the session shape — is written against the same
 * interface and will not need to change.
 *
 * Server-side auth should be: bcrypt or argon2 over the password, an HttpOnly
 * Secure SameSite=Strict session cookie, and no token of any kind in JS.
 */

import type { AuthErrorCode } from '../types';

const USERS_KEY = 'logicraft.auth.users.v1';
const SESSION_KEY = 'logicraft.auth.session.v1';

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

/** A stored account record. */
export interface StoredUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  passwordDigest: string;
  createdAt: string;
}

/** The session shape kept in web storage. */
export interface Session {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  startedAt: string;
}

function readAll(): StoredUser[] {
  const store = persistent();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(USERS_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeAll(users: StoredUser[]): void {
  const store = persistent();
  if (!store) return;
  store.setItem(USERS_KEY, JSON.stringify(users));
}

const normaliseEmail = (email: unknown): string => String(email || '').trim().toLowerCase();

/* ADAPTER --------------------------------------------------------------- */

/** Not a security boundary. See the note at the top of this file. */
function digest(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ----------------------------------------------------------------------- */

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

/**
 * Seeds one known account so the form can be exercised without signing up, and
 * so a fresh deploy is never an empty wall.
 */
function ensureSeedAccount(): void {
  const users = readAll();
  if (users.some((u) => u.email === DEMO_ACCOUNT.email)) return;

  users.push({
    id: 'usr_seed_demo',
    name: 'Demo Operator',
    company: 'LogiCraft',
    role: 'Operations Manager',
    email: DEMO_ACCOUNT.email,
    passwordDigest: digest(DEMO_ACCOUNT.password),
    createdAt: new Date().toISOString()
  });
  writeAll(users);
}

function startSession(user: StoredUser, remember: boolean): Session {
  const session: Session = {
    id: user.id,
    name: user.name,
    email: user.email,
    company: user.company,
    role: user.role,
    startedAt: new Date().toISOString()
  };

  const target = remember ? persistent() : scoped();
  const other = remember ? scoped() : persistent();
  if (target) target.setItem(SESSION_KEY, JSON.stringify(session));
  if (other) other.removeItem(SESSION_KEY);
  return session;
}

/**
 * Throws an `Error` with a `code` of 'duplicate-email' or 'invalid-credentials',
 * so the form can tell "that account exists" from "those details are wrong"
 * without parsing message strings.
 */
export async function signUp({ name, email, company, role, password }: SignUpInput): Promise<Session> {
  await wait(550);

  ensureSeedAccount();
  const users = readAll();
  const key = normaliseEmail(email);

  if (users.some((u) => u.email === key)) {
    const error = new Error('An account with that email already exists.') as AuthError;
    error.code = 'duplicate-email';
    throw error;
  }

  const user: StoredUser = {
    id: `usr_${Date.now().toString(36)}`,
    name: name.trim(),
    email: key,
    company: company.trim(),
    role,
    passwordDigest: digest(password),
    createdAt: new Date().toISOString()
  };

  writeAll([...users, user]);
  return startSession(user, true);
}

export async function signIn({ email, password, remember = true }: SignInInput): Promise<Session> {
  await wait(550);

  ensureSeedAccount();
  const user = readAll().find((u) => u.email === normaliseEmail(email));

  // Same message and roughly the same work either way, so a wrong email and a
  // wrong password are not distinguishable from the outside.
  if (!user || user.passwordDigest !== digest(password)) {
    const error = new Error('That email and password combination does not match an account.') as AuthError;
    error.code = 'invalid-credentials';
    throw error;
  }

  return startSession(user, remember);
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
      if (raw) return JSON.parse(raw) as Session;
    } catch {
      /* fall through to the next store */
    }
  }
  return null;
}

export function hasSession(): boolean {
  return getSession() !== null;
}
