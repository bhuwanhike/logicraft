import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { MapCanvas } from './MapCanvas';
import type { MapMarker } from './MapCanvas';
import { loadGoogleMaps, mapsAuthFailure, mapsMapId } from '../../services/googleMaps';
import type { MapsLoadFailure } from '../../services/googleMaps';
import { buildMarkerIcon, markerKey, popupHtml } from './mapMarkers';
import type {
  GoogleInfoWindow,
  GoogleMap,
  GoogleMarker,
  GoogleMapsWindow
} from '../../services/googleMaps';

/**
 * A marker on the Google map.
 *
 * Coordinates are real WGS84 degrees, unlike the `MapCanvas` adapter's
 * projected `x`/`y` percentages. `heading` rotates the pin to the bearing the
 * telemetry reports, and `speedKph` is shown in the popup.
 */
export interface FleetMarker extends MapMarker {
  /** WGS84 degrees. Required for a real map. */
  lat: number;
  lng: number;
  heading?: number | null;
  speedKph?: number | null;
  /** Secondary lines in the popup, e.g. plate and driver. */
  details?: string[];
}

/** Props for {@link FleetMap}. */
export interface FleetMapProps {
  markers?: FleetMarker[];
  /** Frame height: pixels, or any CSS length. */
  height?: number | string;
  className?: string;
  emptyTitle?: string;
  emptyText?: string;
  emptyAction?: ReactNode;
  onMarkerSelect?: (marker: FleetMarker) => void;
  selectedId?: string | null;
  children?: ReactNode;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'no-key';

/**
 * Fleet map backed by the Google Maps JavaScript API.
 *
 * The previous `MapCanvas` is a deliberate no-credentials adapter: it owns the
 * marker contract and empty state but has no tile provider. This component is
 * the real tile layer, and it keeps that contract intact so the surrounding UI
 * does not change. When no API key is configured it renders the same
 * `MapCanvas` the dashboard already used, so a missing key degrades to the
 * existing experience instead of a grey void with a spinner.
 *
 * Markers are reconciled by id rather than recreated. Telemetry polling changes
 * positions on every response, and tearing down all markers each poll would
 * drop the popup and reset the click target mid-interaction.
 */
export function FleetMap({
  markers = [],
  height = 330,
  className = '',
  emptyTitle = 'No live positions',
  emptyText = 'Active trip telemetry will plot here once a location feed is connected.',
  emptyAction,
  onMarkerSelect,
  selectedId = null,
  children
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const googleRef = useRef<GoogleMapsWindow | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null);
  // Marker handles keyed by the marker id, so a poll updates positions instead
  // of rebuilding the layer.
  const handlesRef = useRef(new Map<string, GoogleMarker>());
  // Set once the operator pans or zooms, which stops background polls from
  // yanking the viewport back to the fleet bounds.
  const userMovedRef = useRef(false);
  const [state, setState] = useState<LoadState>('idle');
  // The SDK's own rejection reason, so the message names the real cause.
  const [reason, setReason] = useState<MapsLoadFailure | null>(null);

  // Latest values for the click handler, which is registered once per marker
  // and must not capture a stale render's props.
  const onSelectRef = useRef(onMarkerSelect);
  onSelectRef.current = onMarkerSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Create the map once the SDK is ready.
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled) return;
        if (!google) {
          setReason(mapsAuthFailure());
          setState(hasConfiguredKey() ? 'unavailable' : 'no-key');
          return;
        }
        const node = containerRef.current;
        if (!node) return;

        googleRef.current = google;
        infoWindowRef.current = new google.maps.InfoWindow();

        const map = new google.maps.Map(node, {
          center: { lat: 41.8781, lng: -87.6298 },
          zoom: 5,
          // A muted style keeps the fleet readable against the existing panel
          // palette; without it the default map is louder than the UI around it.
          ...(mapsMapId() ? { mapId: mapsMapId() } : {}),
          ...(mapsMapId() ? {} : { styles: DESATURATED_STYLES })
        });
        mapRef.current = map;
        setState('ready');
      })
      .catch(() => {
        // Any throw above used to escape the promise and leave the effect dead:
        // state stuck on 'loading' with an empty surface over a dark frame,
        // i.e. a black rectangle with no explanation. Construction failures are
        // a configuration problem, so they surface as 'unavailable' and reuse
        // the message that already tells the operator what to check.
        if (!cancelled) {
          setReason(mapsAuthFailure());
          setState(hasConfiguredKey() ? 'unavailable' : 'no-key');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile markers whenever the set of positions changes.
  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (state !== 'ready' || !google || !map) return;

    const seen = new Set<string>();
    const bounds = new google.maps.LatLngBounds();
    let placed = 0;

    for (const marker of markers) {
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) continue;
      const id = markerKey(marker);
      seen.add(id);
      const position = new google.maps.LatLng(marker.lat, marker.lng);

      let handle = handlesRef.current.get(id);
      if (!handle) {
        handle = new google.maps.Marker({
          map,
          position,
          title: marker.label,
          label: marker.tone === 'warn' ? { text: '!', color: '#ffffff' } : undefined,
          icon: buildMarkerIcon(google, marker),
          zIndex: selectedIdRef.current === id ? 1000 : undefined
        });

        handle.addEventListener?.('click', () => {
          const current = markers.find((candidate) => markerKey(candidate) === id);
          infoWindowRef.current?.setContent(popupHtml(current ?? marker));
          // The anchor must be a LatLng instance; a plain object is ignored by
          // the SDK and the popup opens at the wrong place or not at all.
          infoWindowRef.current?.open({ map, anchor: position });
          onSelectRef.current?.(current ?? (marker as FleetMarker));
        });

        handlesRef.current.set(id, handle);
      } else {
        handle.setPosition(position);
        if (handle.setIcon) handle.setIcon(buildMarkerIcon(google, marker));
      }

      if (handle.setZIndex) handle.setZIndex(selectedIdRef.current === id ? 1000 : undefined);
      bounds.extend(position);
      placed += 1;
    }

    // Drop markers for positions no longer in the response.
    for (const [id, handle] of handlesRef.current) {
      if (seen.has(id)) continue;
      handle.setMap(null);
      google.maps.event.clearInstanceListeners(handle);
      handlesRef.current.delete(id);
    }

    // Frame the fleet. Bounds are only refit while the user has not taken
    // manual control, otherwise a background poll yanks the viewport back.
    if (placed > 0 && !bounds.isEmpty() && !userMovedRef.current) {
      map.fitBounds(bounds);
    }
  }, [markers, state, selectedId]);

  // Track whether the operator has panned/zoomed, to stop auto-refitting.
  useEffect(() => {
    if (state !== 'ready') return undefined;
    const node = containerRef.current;
    if (!node) return undefined;
    // The SDK replaces the container's children, so listen on the container
    // itself for bubbled interactions.
    const markMoved = () => {
      userMovedRef.current = true;
    };
    node.addEventListener('wheel', markMoved, { passive: true });
    return () => node.removeEventListener('wheel', markMoved);
  }, [state]);

  // Tear down the SDK instances on unmount so a remount starts clean.
  useEffect(() => {
    return () => {
      const google = googleRef.current;
      for (const handle of handlesRef.current.values()) {
        handle.setMap(null);
        if (google) google.maps.event.clearInstanceListeners(handle);
      }
      handlesRef.current.clear();
      infoWindowRef.current?.close();
      mapRef.current = null;
    };
  }, []);

  const hasPositions = markers.length > 0;

  if (state === 'no-key') {
    // No credentials: keep the pre-existing adapter so nothing regresses.
    return (
      <MapCanvas
        markers={markers}
        height={height}
        className={className}
        emptyTitle={emptyTitle}
        emptyText={emptyText}
        emptyAction={emptyAction}
        onMarkerSelect={(marker) => onMarkerSelect?.(marker as FleetMarker)}
        selectedId={selectedId}
      >
        {children}
      </MapCanvas>
    );
  }

  if (state === 'unavailable') {
    return (
      <div
        className={`map-frame ${className}`.trim()}
        style={{ height }}
        role="region"
        aria-label="Operational map"
      >
        <div className="map-empty" style={{ minHeight: typeof height === 'number' ? height * 0.7 : undefined }}>
          <AlertTriangle size={22} aria-hidden="true" />
          <b>Map unavailable</b>
          <span>{failureMessage(reason)}</span>
          {emptyAction}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`map-frame map-frame-google ${className}`.trim()}
      style={{ height }}
      role="region"
      aria-label="Operational map"
    >
      {/* `data-marker-count` exists because a classic Marker renders as a bare
          absolutely-positioned div with no class or role, so there is no stable
          way to count pins from the DOM. Live verification reads this instead. */}
      <div ref={containerRef} className="map-surface" data-marker-count={markers.length} />

      {state === 'loading' && (
        <div className="map-loading" style={{ minHeight: typeof height === 'number' ? height * 0.7 : undefined }}>
          <Layers size={22} aria-hidden="true" />
          <b>Loading map</b>
          <span>Contacting Google Maps…</span>
        </div>
      )}

      {!hasPositions && state === 'ready' && (
        <div className="map-empty map-empty-overlay">
          <Layers size={22} aria-hidden="true" />
          <b>{emptyTitle}</b>
          <span>{emptyText}</span>
          {emptyAction}
        </div>
      )}

      <GoogleMapControls
        map={mapRef.current}
        onRecentre={() => {
          userMovedRef.current = false;
          const map = mapRef.current;
          if (!map || !googleRef.current || markers.length === 0) return;
          const bounds = new googleRef.current.maps.LatLngBounds();
          for (const marker of markers) bounds.extend(new googleRef.current.maps.LatLng(marker.lat, marker.lng));
          map.fitBounds(bounds);
        }}
      />

      {children}
    </div>
  );
}

/** Zoom and recentre controls, which the SDK does not provide. */
function GoogleMapControls({ map, onRecentre }: { map: GoogleMap | null; onRecentre: () => void }) {
  const adjust = (delta: number) => {
    if (!map) return;
    const current = map.getZoom() ?? 5;
    map.setZoom(Math.min(20, Math.max(2, current + delta)));
  };

  return (
    <div className="map-controls">
      <button type="button" onClick={() => adjust(1)} aria-label="Zoom in">
        +
      </button>
      <button type="button" onClick={() => adjust(-1)} aria-label="Zoom out">
        −
      </button>
      <button type="button" onClick={onRecentre} aria-label="Fit all vehicles">
        ⌖
      </button>
    </div>
  );
}

function hasConfiguredKey(): boolean {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim().length > 0;
}

/**
 * Explains the failure using the reason the SDK itself reported.
 *
 * Naming the actual cause matters: the three causes look identical from the UI
 * otherwise, and each is fixed in a different screen in the Cloud console.
 */
function failureMessage(reason: MapsLoadFailure | null): string {
  switch (reason) {
    case 'not-activated':
      return (
        'The Maps JavaScript API is not enabled on the Cloud project that owns ' +
        'this key. Open APIs & Services → Library, enable "Maps JavaScript API", ' +
        'and make sure it is the same project as the key.'
      );
    case 'referrer-blocked':
      return (
        'Google rejected this page\'s origin. The key\'s HTTP referrer ' +
        'restriction does not match this URL — add the exact origin, e.g. ' +
        '"localhost/*" for local development, then hard-refresh.'
      );
    case 'invalid-key':
      return 'The API key is malformed or was deleted. Check it in the Cloud console.';
    default:
      return (
        'Google Maps did not load. The most likely cause is that the Maps ' +
        'JavaScript API is not enabled on the Cloud project behind this key, or ' +
        'that its HTTP referrer restriction does not allow this origin. Both are ' +
        'fixed in the Cloud console — no code change is needed.'
      );
  }
}

/**
 * Desaturated style applied when no cloud map ID is configured.
 *
 * Greys the base map so the coloured truck pins stay the most saturated thing
 * on screen, which is the point of the panel. The values are kept well short of
 * black: a near-black land fill made an unloaded map indistinguishable from a
 * broken one, and dropped every road label below a readable contrast.
 */
const DESATURATED_STYLES: unknown[] = [
  { elementType: 'geometry', stylers: [{ saturation: -25 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5f6368' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] }
];
