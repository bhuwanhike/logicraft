import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Fuel, Navigation, Search, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { useDebouncedValue } from '../../hooks/useUi';
import { FleetMap } from '../common/FleetMap';
import { ResourceState } from '../common/ResourceState';
import { TrendChart } from '../common/TrendChart';
import {StatusPill, formatDate, num, text} from './format';
import type { Row } from '../../types';
import type { UseCollectionResult } from '../../types';
import type { FleetMarker } from '../common/FleetMap';
import type { Series } from '../common/TrendChart';

/** One selectable trip-status filter. */
interface StatusOption {
  value: string;
  label: string;
}

const SPEED_SERIES: Series[] = [{ key: 'speedKph', label: 'km/h' }];

const STATUSES: StatusOption[] = [
  { value: 'all', label: 'All trips' },
  { value: 'active', label: 'Active' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'completed', label: 'Completed' }
];

/**
 * Tracking Center.
 *
 * A full-height map with a collapsible trip panel docked on the left. The
 * panel collapses to an edge handle so the map can take the full width, which
 * is the reason the collapse exists rather than a cosmetic toggle.
 */
export function TrackingPage() {
  // Seeded from ?ref= so the dashboard's "Track" action lands on the trip it
  // named rather than on an unfiltered list.
  const [searchParams] = useSearchParams();
  const deepLinkRef = searchParams.get('ref') ?? '';

  const [query, setQuery] = useState<string>(deepLinkRef);
  const [status, setStatus] = useState<string>('all');
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query);
  const trips = useCollection(api.trips.list, { q: debouncedQuery, status });

  const selected = useMemo(
    () => trips.data.find((t: Row) => t.id === selectedId) ?? trips.data[0] ?? null,
    [trips.data, selectedId]
  );

  // Speed history for the selected trip, fetched only once a trip is chosen.
  const selectedTripId = text(selected?.id, '');
  const history = useCollection(
    () => api.metrics.series('speed', { tripId: selectedTripId }),
    { tripId: selectedTripId },
    { enabled: Boolean(selected) }
  );

  // Raw WGS84 degrees; the previous version wrote them into x/y, which
  // MapCanvas re-projects as if they were percentages.
  const markers = useMemo<FleetMarker[]>(
    () =>
      trips.data
        .map((trip: Row): FleetMarker | null => {
          const lat = num(trip.lat);
          const lng = num(trip.lng);
          if (lat === null || lng === null) return null;
          return {
            id: text(trip.id, ''),
            lat,
            lng,
            label: text(trip.reference ?? trip.plate, 'Trip'),
            heading: num(trip.headingDeg),
            speedKph: num(trip.speedKph),
            tone:
              trip.status === 'delayed' ? 'warn' : trip.status === 'completed' ? 'done' : 'live',
            details: [
              `Vehicle: ${text(trip.vehiclePlate, 'Unassigned')}`,
              `Driver: ${text(trip.driverName, 'Unassigned')}`
            ]
          };
        })
        .filter((marker): marker is FleetMarker => marker !== null),
    [trips.data]
  );

  return (
    <div className={`tracking-layout ${panelOpen ? '' : 'panel-collapsed'}`}>
      <aside className="trip-panel" aria-label="Active trips">
        <header className="trip-panel-head">
          <div>
            <h2>Trips</h2>
            <span className="panel-meta">
              {trips.isLoading ? 'loading…' : `${trips.data.length} found`}
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPanelOpen(false)}
            aria-label="Collapse trip panel"
          >
            <ChevronLeft size={16} />
          </button>
        </header>

        <div className="trip-filters">
          <div className="table-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trips"
              aria-label="Search trips"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by trip status">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="trip-list">
          <ResourceState state={trips} noun="trips" skeleton="panel" onRetry={trips.refetch}>
            {trips.data.map((trip: Row) => (
              <button
                key={text(trip.id, '')}
                type="button"
                className={`trip-card ${selected?.id === trip.id ? 'is-active' : ''}`.trim()}
                onClick={() => setSelectedId(text(trip.id, ''))}
              >
                <div className="trip-card-top">
                  <b>{text(trip.reference ?? trip.plate, 'Trip')}</b>
                  <StatusPill status={trip.status} />
                </div>
                <span className="trip-card-route">
                  {text(trip.origin)} <i>to</i> {text(trip.destination)}
                </span>
                <span className="trip-card-meta">
                  <em>
                    <Navigation size={11} /> {formatCoord(trip.lat)}, {formatCoord(trip.lng)}
                  </em>
                  <em>
                    <Clock size={11} /> {formatDate(trip.eta)}
                  </em>
                </span>
              </button>
            ))}
          </ResourceState>
        </div>
      </aside>

      {!panelOpen && (
        <button
          type="button"
          className="panel-reopen"
          onClick={() => setPanelOpen(true)}
          aria-label="Expand trip panel"
        >
          <ChevronRight size={16} />
        </button>
      )}

      <section className="tracking-map">
        <FleetMap
          markers={markers}
          selectedId={text(selected?.id, '')}
          onMarkerSelect={(marker) => setSelectedId(marker.id ?? null)}
          className="is-flush"
          height="100%"
          emptyTitle="No trips reporting"
          emptyText="Live positions plot here as soon as the tracking service is connected."
        />

        {selected && <TripTelemetry trip={selected} history={history} />}
      </section>
    </div>
  );
}

/** Telemetry card for the selected trip, overlaid on the map. */
/** Props for {@link TripTelemetry}. */
interface TripTelemetryProps {
  trip: Row;
  history: UseCollectionResult;
}

function TripTelemetry({ trip, history }: TripTelemetryProps) {
  return (
    <article className="telemetry">
      <header>
        <div>
          <b>{text(trip.reference ?? trip.plate, 'Selected trip')}</b>
          <small>{text(trip.driverName, 'Unassigned driver')}</small>
        </div>
        <StatusPill status={trip.status} />
      </header>

      <dl className="telemetry-grid">
        <div>
          <dt>
            <Navigation size={12} /> Position
          </dt>
          <dd>
            {formatCoord(trip.lat)}, {formatCoord(trip.lng)}
          </dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{num(trip.speedKph) === null ? '—' : `${text(trip.speedKph)} km/h`}</dd>
        </div>
        <div>
          <dt>
            <Fuel size={12} /> Fuel
          </dt>
          <dd>{num(trip.fuelLevel) === null ? '—' : `${text(trip.fuelLevel)}%`}</dd>
        </div>
        <div>
          <dt>
            <Truck size={12} /> Vehicle
          </dt>
          <dd>{text(trip.vehiclePlate)}</dd>
        </div>
      </dl>

      <div className="telemetry-chart">
        <h4>Speed history</h4>
        <TrendChart
          data={history.data ?? []}
          xKey="at"
          kind="area"
          height={130}
          series={SPEED_SERIES}
          emptyTitle="No speed history"
          emptyText="Telemetry samples appear once the trip is streaming."
        />
      </div>
    </article>
  );
}

function formatCoord(value: unknown): string {
  if (value === undefined || value === null) return '—';
  return Number(value).toFixed(4);
}
