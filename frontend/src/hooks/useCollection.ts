import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api';
import type {
  CollectionError,
  LoadStatus,
  ListFetcher,
  QueryParams,
  RequestOptions,
  ResourceFetcher,
  Rows,
  UseCollectionResult,
  UseResourceResult
} from '../types';

/**
 * Minimum time a request stays pending, in ms.
 *
 * Without this, a local request that fails instantly makes the loading state
 * invisible — the skeleton flashes for one frame and the user never sees it.
 * Set to 0 once a real API is connected and real network latency applies.
 */
const MIN_PENDING_MS = 260;

const IDLE: { status: LoadStatus; data: Rows; error: null } = {
  status: 'loading',
  data: [],
  error: null
};

/** Options accepted by both collection hooks. */
export interface UseCollectionOptions {
  enabled?: boolean;
  minPendingMs?: number;
}

/** Internal state shape, shared by the two hooks. */
interface InternalState {
  status: LoadStatus;
  data: unknown;
  error: CollectionError | null;
}

/** Reduces any thrown value to the error shape the UI renders. */
function toCollectionError(error: unknown): CollectionError {
  const err = error as { code?: string; message?: string } | null;
  return {
    code: err?.code ?? 'unknown',
    message: err?.message ?? 'Something went wrong.',
    missingSource: error instanceof ApiError && error.code === 'no-source'
  };
}

/**
 * Fetches a collection and exposes it as an explicit state machine.
 *
 *   loading — a request is in flight, render a skeleton
 *   ready   — a response arrived; check `isEmpty` and render either rows or
 *             an empty state with a CTA
 *   error   — the request failed; `error.code === 'no-source'` means no data
 *             source is connected, which is the normal case until the backend
 *             lands and is what the empty states are written around
 *
 * No component in this codebase should ever invent rows to avoid one of these
 * three states. That is the whole point of the shape.
 */
export function useCollection(
  fetcher: ListFetcher,
  params: QueryParams = {},
  { enabled = true, minPendingMs = MIN_PENDING_MS }: UseCollectionOptions = {}
): UseCollectionResult {
  const [state, setState] = useState<InternalState>(IDLE);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  // Params is almost always a fresh object literal on every render, so it is
  // serialised to decide whether a refetch is actually warranted.
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return undefined;
    }

    const controller = new AbortController();
    const ticket = ++latest.current;
    const startedAt = Date.now();

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    const settle = (next: InternalState) => {
      // A slow earlier request must not overwrite a newer one.
      if (ticket !== latest.current) return;
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, minPendingMs - elapsed);
      if (wait === 0) {
        setState(next);
        return;
      }
      setTimeout(() => {
        if (ticket === latest.current) setState(next);
      }, wait);
    };

    fetcher(params, { signal: controller.signal } as RequestOptions)
      .then((data) => {
        const list = Array.isArray(data) ? (data as Rows) : [];
        settle({ status: 'ready', data: list, error: null });
      })
      .catch((error) => {
        if ((error as { name?: string } | null)?.name === 'AbortError') return;
        settle({ status: 'error', data: [], error: toCollectionError(error) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce, minPendingMs]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  const data = state.data as Rows;

  return {
    status: state.status,
    data,
    error: state.error,
    isLoading: state.status === 'loading',
    isReady: state.status === 'ready',
    isError: state.status === 'error',
    // "Empty" covers both a connected source that genuinely has no rows and a
    // source that is not connected — the UI copy differs, the branch is the same.
    isEmpty: state.status !== 'loading' && data.length === 0,
    missingSource: state.error?.missingSource ?? false,
    refetch
  };
}

/** Single-object variant, for the dashboard KPI row. */
export function useResource(
  fetcher: ResourceFetcher,
  params: QueryParams = {},
  { enabled = true, minPendingMs = MIN_PENDING_MS }: UseCollectionOptions = {}
): UseResourceResult {
  const [state, setState] = useState<InternalState>({
    status: 'loading',
    data: null,
    error: null
  });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const ticket = ++latest.current;
    const startedAt = Date.now();

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    const settle = (next: InternalState) => {
      if (ticket !== latest.current) return;
      const wait = Math.max(0, minPendingMs - (Date.now() - startedAt));
      if (wait === 0) setState(next);
      else setTimeout(() => ticket === latest.current && setState(next), wait);
    };

    fetcher(params, { signal: controller.signal } as RequestOptions)
      .then((data) => settle({ status: 'ready', data, error: null }))
      .catch((error) => {
        if ((error as { name?: string } | null)?.name === 'AbortError') return;
        settle({ status: 'error', data: null, error: toCollectionError(error) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce, minPendingMs]);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    isLoading: state.status === 'loading',
    isReady: state.status === 'ready',
    isError: state.status === 'error',
    missingSource: state.error?.missingSource ?? false,
    refetch: useCallback(() => setNonce((n) => n + 1), [])
  };
}

export { MIN_PENDING_MS };
