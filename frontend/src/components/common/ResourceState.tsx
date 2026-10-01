import { Database, Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { TableSkeleton } from './Skeleton';
import type { CollectionError, LoadStatus } from '../../types';

/**
 * The one place a collection's three states are turned into UI.
 *
 * Every module routes its hook output through here, which is what makes the
 * "no fabricated rows" rule structural rather than a convention: there is no
 * code path that renders a table without either real rows or a real skeleton.
 *
 *   loading — skeleton
 *   error   — explains the failure, offers retry
 *   empty   — names the missing resource, offers the next action
 */

/**
 * The slice of a collection hook's return value this component reads. Declared
 * structurally rather than importing the full hook result, so pages can pass
 * either useCollection or useResource output.
 */
export interface ResourceStateLike {
  status: LoadStatus;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  missingSource: boolean;
  error?: CollectionError | null;
}

export interface ResourceStateProps {
  state: ResourceStateLike;
  noun?: string;
  /** 'table' renders row skeletons; anything else renders a centred spinner. */
  skeleton?: 'table' | 'panel';
  skeletonRows?: number;
  children?: ReactNode;
  cta?: ReactNode;
  onRetry?: () => void;
}

export function ResourceState({
  state,
  noun = 'records',
  skeleton = 'table',
  skeletonRows = 6,
  children,
  cta,
  onRetry
}: ResourceStateProps) {
  if (state.isLoading) {
    return skeleton === 'table' ? (
      <TableSkeleton rows={skeletonRows} cols={6} />
    ) : (
      <div className="panel empty-state" aria-busy="true" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <b>Loading {noun}</b>
        <span>Fetching the latest from your connected source.</span>
      </div>
    );
  }

  if (state.isError) {
    return (
      <div className="panel empty-state is-error" role="alert">
        <TriangleAlert size={22} aria-hidden="true" />
        <b>{state.missingSource ? 'No data source connected' : 'Could not load this view'}</b>
        <span>
          {state.missingSource
            ? `The ${noun} endpoint has no server behind it yet, so there is nothing to show. Nothing is displayed here rather than filling it with sample rows.`
            : state.error?.message}
        </span>
        {onRetry && (
          <button type="button" className="button" onClick={onRetry}>
            <RefreshCw size={14} /> Try again
          </button>
        )}
      </div>
    );
  }

  if (state.isEmpty) {
    return (
      <div className="panel empty-state" aria-live="polite">
        <Inbox size={22} aria-hidden="true" />
        <b>No {noun} yet</b>
        <span>
          This view is connected and ready, but your source has not returned any {noun} yet.
        </span>
        {cta}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Compact variant for a panel that is a secondary region rather than the page
 * focus, e.g. the dashboard exception feed beside the map.
 */
export interface InlineResourceStateProps {
  state: ResourceStateLike;
  noun: string;
  children?: ReactNode;
  cta?: ReactNode;
  onRetry?: () => void;
}

export function InlineResourceState({ state, noun, children, cta, onRetry }: InlineResourceStateProps) {
  if (state.isLoading) {
    return (
      <div className="inline-state" aria-busy="true">
        <span className="spinner" aria-hidden="true" /> Loading {noun}
      </div>
    );
  }

  if (state.isError) {
    return (
      <div className="inline-state is-error">
        <Database size={15} aria-hidden="true" />
        <span>{state.missingSource ? `No ${noun} source connected` : state.error?.message}</span>
        {onRetry && (
          <button type="button" className="link" onClick={onRetry}>
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    );
  }

  if (state.isEmpty) {
    return (
      <div className="inline-state">
        <Inbox size={15} aria-hidden="true" />
        <span>No {noun} to display</span>
        {cta}
      </div>
    );
  }

  return <>{children}</>;
}

export default ResourceState;
