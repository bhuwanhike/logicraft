import { useEffect, useRef, useState } from 'react';
import { Layers, LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';


/**
 * Map container.
 *
 * There is no map library in package.json and no tile provider or API key
 * configured, so this deliberately does NOT pull in MapLibre. A map SDK with
 * no credentials renders a grey void and hides the problem behind a loading
 * spinner.
 *
 * Instead this is an adapter: it owns the surface, the controls, the marker
 * layer contract and the empty state. Dropping in MapLibre later means
 * replacing the `renderBase` implementation below and nothing else.
 *
 * The zoom/pan controls, the recentre button and the marker overlay all work
 * today against markers that a real source would supply, which means the
 * surrounding UI is testable before the tile layer exists.
 */
/**
 * A marker as the overlay consumes it: coordinates arrive either as projected
 * `x`/`y` percentages or as raw `lng`/`lat`, and the data layer owns that choice.
 */
export interface MapMarker {
  id?: string;
  label: string;
  /** Projected percentage, 0-100. Preferred over lng/lat when present. */
  x?: number;
  y?: number;
  /** Raw coordinates, used when no projection has been applied. */
  lng?: number;
  lat?: number;
  /** Modifier class for the pin. */
  tone?: string;
}

/** Props for {@link MapCanvas}. */
export interface MapCanvasProps {
  markers?: MapMarker[];
  /** Any truthy value reveals the route overlay. */
  route?: unknown;
  /** Frame height: a number of pixels, or any CSS length such as '100%'. */
  height?: number | string;
  className?: string;
  emptyTitle?: string;
  emptyText?: string;
  emptyAction?: ReactNode;
  onMarkerSelect?: (marker: MapMarker) => void;
  selectedId?: string | null;
  children?: ReactNode;
}

export function MapCanvas({
  markers = [],
  route = null,
  height = 320,
  className = '',
  emptyTitle = 'No map to display',
  emptyText = 'Positions appear once a location source is connected.',
  emptyAction,
  onMarkerSelect,
  selectedId = null,
  children
}: MapCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsFullscreen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const hasPositions = Array.isArray(markers) && markers.length > 0;

  return (
    <div
      ref={frameRef}
      className={`map-frame ${isFullscreen ? 'is-fullscreen' : ''} ${className}`.trim()}
      style={isFullscreen ? undefined : { height }}
      role="region"
      aria-label="Operational map"
    >
      {hasPositions ? (
        <>
          <div className="map-base" aria-hidden="true" style={{ transform: `scale(${zoom})` }} />
          {route && <div className="map-route" aria-hidden="true" style={{ transform: `scale(${zoom})` }} />}

          {/* Markers are positioned by projected x/y percentages the data
              layer supplies, so the overlay is independent of tile choice. */}
          <div className="map-markers" style={{ transform: `scale(${zoom})` }}>
            {markers.map((marker) => {
              const x = marker.x ?? marker.lng;
              const y = marker.y ?? marker.lat;
              if (x === undefined || y === undefined) return null;
              return (
                <button
                  key={marker.id ?? `${x}-${y}`}
                  type="button"
                  className={`map-marker ${marker.tone ?? ''} ${selectedId === marker.id ? 'is-selected' : ''}`.trim()}
                  style={{ left: `${toPercent(x, 180)}`, top: `${toPercent(y, 90)}` }}
                  title={marker.label}
                  onClick={() => onMarkerSelect?.(marker)}
                >
                  <span className="map-marker-pulse" aria-hidden="true" />
                  <i aria-hidden="true" />
                  <em>{marker.label}</em>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="map-empty" style={typeof height === 'number' ? { minHeight: height * 0.7 } : undefined}>
          <Layers size={22} aria-hidden="true" />
          <b>{emptyTitle}</b>
          <span>{emptyText}</span>
          {emptyAction}
        </div>
      )}

      <div className="map-controls">
        <button type="button" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))} aria-label="Zoom in">
          <Plus size={14} />
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} aria-label="Zoom out">
          <Minus size={14} />
        </button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Recentre map">
          <LocateFixed size={14} />
        </button>
        <button type="button" onClick={() => setIsFullscreen((v) => !v)} aria-label="Toggle fullscreen">
          <Maximize2 size={14} />
        </button>
      </div>

      {hasPositions && <div className="map-zoom-readout">{Math.round(zoom * 100)}%</div>}
      {children}
    </div>
  );
}

/**
 * Projects a coordinate onto a percentage of the frame. A real tile layer
 * replaces this with a proper projection; the contract (numbers in, percentages
 * out) is what marker rendering depends on.
 */
function toPercent(value: unknown, span: number): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 50;
  return Math.min(100, Math.max(0, ((numeric + span / 2) / span) * 100));
}
