/**
 * Shared domain types.
 *
 * The API does not exist yet (see services/api.ts), so these describe the shape
 * the UI is already written against rather than a server contract. Row types are
 * intentionally loose: every field is optional plus an index signature, because
 * `toList()` normalises whatever a backend eventually returns and the pages
 * already guard with `?.` and `??`. Tightening them is the right call the day a
 * real schema exists.
 */

/** A row from any collection endpoint. Fields vary by module, so extras are allowed. */
export type Row = Record<string, unknown>;

/** Rows as they come out of a collection request. */
export type Rows = Row[];

/** Filter values passed to `api.*.list()`. */
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Options accepted by every request: abort signal, HTTP method, body. */
export interface RequestOptions {
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** Machine-readable failure reasons, used by the UI to pick empty-state copy. */
export type ApiErrorCode = 'no-source' | 'request-failed' | 'unknown' | (string & {});

/** Error code carried by the auth service on thrown `Error`s. */
export type AuthErrorCode = 'duplicate-email' | 'invalid-credentials';

/** The three states a collection request can be in. */
export type LoadStatus = 'loading' | 'ready' | 'error';

/** Error as the hooks expose it to components. */
export interface CollectionError {
  code: ApiErrorCode;
  message: string;
  /** True when the failure is "no API connected", which is the normal case today. */
  missingSource: boolean;
}

/** A fetcher the collection hooks can drive. */
export type ListFetcher = (params?: QueryParams, options?: RequestOptions) => Promise<unknown>;
/** Single-object fetcher, e.g. the dashboard KPI summary. */
export type ResourceFetcher = (params?: QueryParams, options?: RequestOptions) => Promise<unknown>;

/** Toast tone used by `notify()` in WorkspaceContext. */
export type ToastTone = 'success' | 'error' | 'info';

/** Toast published by the workspace provider. */
export interface Toast {
  message: string;
  tone: ToastTone;
  id: number;
}

/** A registered create-modal opener, keyed by name. */
export type ModalOpener = () => void;
export type ModalRegistry = Record<string, ModalOpener>;

/** Sidebar badge counts, derived from live collections. */
export interface WorkspaceCounts {
  vehicles: number;
  shipments: number;
  notifications: number;
  notificationsUnread: number;
}

/** An entry the command palette can search and the create menu can launch. */
export interface Entity {
  id: string;
  label: string;
  path: string;
  search: (term: string, options?: RequestOptions) => Promise<Row[]>;
}

/** An item in the global "+ Create" menu. */
export interface CreateAction {
  id: string;
  label: string;
  entity: string;
}

/** Theme, as persisted by useTheme and read by index.html. */
export type Theme = 'light' | 'dark';

/** Sort state owned by useSortedRows. */
export interface SortState {
  key: string | null;
  direction: SortDirection;
}
export type SortDirection = 'asc' | 'desc';

/** Theme + persistence return value of useTheme. */
export interface UseThemeResult {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

/** Disclosure state returned by useDisclosure. */
export interface UseDisclosureResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/** Value returned by useCollection. */
export interface UseCollectionResult<T = Rows> {
  status: LoadStatus;
  data: T;
  error: CollectionError | null;
  isLoading: boolean;
  isReady: boolean;
  isError: boolean;
  isEmpty: boolean;
  missingSource: boolean;
  refetch: () => void;
}

/** Value returned by useResource (single object variant). */
export interface UseResourceResult<T = unknown> {
  status: LoadStatus;
  data: T | null;
  error: CollectionError | null;
  isLoading: boolean;
  isReady: boolean;
  isError: boolean;
  // Mirrors UseCollectionResult so a component can be pointed at either hook
  // without having to know which one it received.
  missingSource: boolean;
  refetch: () => void;
}
