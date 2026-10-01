import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, Truck } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Entity, Row } from '../../types';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useDebouncedValue } from '../../hooks/useUi';
import { Modal } from '../common/Overlay';

/**
 * Cmd+K / Ctrl+K command palette.
 *
 * Searches every registered entity in parallel and groups hits by entity type.
 * Results come only from real responses — if no API is connected the palette
 * says so instead of rendering suggestions, because a palette full of invented
 * rows is worse than an empty one.
 */
/** Props for {@link GlobalSearch}. */
export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

/** One entity's hits, plus whether that entity's endpoint failed. */
interface SearchGroup {
  entity: Entity;
  rows: Row[];
  failed?: boolean;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const { entities } = useWorkspace();
  const navigate = useNavigate();
  const [term, setTerm] = useState<string>('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [reachable, setReachable] = useState(true);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(term.trim(), 200);

  // Every hit across every entity, in group order, flattened for arrow-key nav.
  const flat = useMemo(() => groups.flatMap((group) => group.rows.map((row) => ({ row, group }))), [groups]);

  useEffect(() => {
    if (!isOpen) return undefined;

    setTerm('');
    setGroups([]);
    setActive(0);
    // Autofocus after the dialog mounts so the caret is in the field.
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    // A blank query shows the searchable surface rather than firing every
    // endpoint in the app on first open.
    if (debounced.length < 2) {
      setGroups([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    setSearching(true);

    Promise.all(
      entities.map(async (entity) => {
        try {
          const rows = await entity.search(debounced, { signal: controller.signal });
          return { entity, rows: (rows ?? []).slice(0, 5) };
        } catch {
          return { entity, rows: [], failed: true };
        }
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      setGroups(results.filter((group) => group.rows.length > 0));
      setReachable(!results.some((group) => group.failed));
      setSearching(false);
      setActive(0);
    });

    return () => controller.abort();
  }, [debounced, entities, isOpen]);

  const go = (target: unknown) => {
    const path = asText(target);
    if (!path) return;
    onClose();
    navigate(path);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = flat[active];
      if (hit) go(hit.row?.href ?? hit.group.entity.path);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title="Search" onClose={onClose} size="palette">
      <div className="palette">
        <div className="palette-input">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search shipments, vehicles, drivers…"
            aria-label="Search the workspace"
          />
          <kbd>ESC</kbd>
        </div>

        <div className="palette-results">
          {debounced.length < 2 && (
            <div className="palette-hint">
              <Truck size={20} aria-hidden="true" />
              <b>Search across your whole operation</b>
              <span>Type at least two characters to search {entities.length} entity types.</span>
            </div>
          )}

          {debounced.length >= 2 && searching && <div className="palette-hint">Searching…</div>}

          {debounced.length >= 2 && !searching && flat.length === 0 && (
            <div className="palette-hint">
              <b>{reachable ? `No matches for “${debounced}”` : 'No data source connected'}</b>
              <span>
                {reachable
                  ? 'Try a different reference, plate, or name.'
                  : 'Search needs a connected API. It will light up as soon as one is available.'}
              </span>
            </div>
          )}

          {groups.map((group) => (
            <div className="palette-group" key={group.entity.id}>
              <h4>
                {group.entity.label}
                <em>{group.rows.length}</em>
              </h4>
              {group.rows.map((row, rowIndex) => {
                const index = flat.findIndex((hit) => hit.row === row && hit.group === group);
                return (
                  <button
                    key={asText(row.id) || rowIndex}
                    type="button"
                    className={index === active ? 'active' : ''}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(row?.href ?? group.entity.path)}
                  >
                    <span>
                      <b>{labelFor(row, group.entity)}</b>
                      {subLabelFor(row) && <small>{subLabelFor(row)}</small>}
                    </span>
                    {index === active && <CornerDownLeft size={13} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Search hits are loose API rows, so only the primitive label fields are
 * rendered as text; anything else is treated as absent.
 */
function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** Entities disagree on their identifier field, so this is tried in order. */
function labelFor(row: Row, entity: Entity): string {
  const fields = ['label', 'name', 'reference', 'trackingNumber', 'plate', 'id'];
  for (const field of fields) {
    const hit = asText(row?.[field]);
    if (hit) return hit;
  }
  return `${entity.label} record`;
}

function subLabelFor(row: Row): ReactNode {
  const fields = ['status', 'stage', 'type', 'location', 'driverName', 'warehouseName'];
  for (const field of fields) {
    const hit = asText(row?.[field]);
    if (hit) return hit;
  }
  return null;
}
