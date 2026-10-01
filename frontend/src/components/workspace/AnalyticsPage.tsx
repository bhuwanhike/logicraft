import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { TrendChart } from '../common/TrendChart';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { ReactNode } from 'react';
import type { Row } from '../../types';
import type { UseCollectionResult } from '../../types';
import { text } from './format';
import type { Series } from '../common/TrendChart';

/** One selectable date range. */
interface RangeOption {
  value: string;
  label: string;
}

const RANGES: RangeOption[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' }
];

const THROUGHPUT_SERIES: Series[] = [
  { key: 'delivered', label: 'Delivered' },
  { key: 'exception', label: 'Exception' }
];
const ON_TIME_SERIES: Series[] = [{ key: 'onTimeRate', label: 'On-time %' }];
const MODE_MIX_SERIES: Series[] = [{ key: 'value', label: 'Shipments' }];

/**
 * Analytics.
 *
 * Three reports, each backed by its own series endpoint, all filtered by the
 * same date range and facility. Export is a real request for a real blob; it
 * reports failure rather than generating a file locally, because a locally
 * generated report would be indistinguishable from a real one.
 */
export function AnalyticsPage() {
  const { notify } = useWorkspace();
  const [range, setRange] = useState<string>('30d');
  const [facility, setFacility] = useState<string>('all');

  const facilities = useCollection(api.warehouses.list);

  const params = { range, facility };
  const throughput = useCollection(() => api.metrics.series('throughput', params), params);
  const onTime = useCollection(() => api.metrics.series('onTime', params), params);
  const modeMix = useCollection(() => api.metrics.series('modeMix', params), params);

  const report = (key: string, label: string) => async () => {
    try {
      const blob = await api.export.report(key, params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logicraft-${key}-${range}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`${label} downloaded.`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.', 'info');
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Insights</div>
          <h1>Analytics</h1>
          <p>Throughput, reliability, and cost trends across the network.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button" onClick={report('throughput', 'Throughput report')}>
            <FileText size={16} /> CSV
          </button>
          <button type="button" className="button primary" onClick={report('fleet', 'Fleet workbook')}>
            <FileSpreadsheet size={16} /> XLSX
          </button>
        </div>
      </div>

      <div className="filter-bar panel">
        <label className="field inline">
          <span>Date range</span>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field inline">
          <span>Facility</span>
          <select value={facility} onChange={(e) => setFacility(e.target.value)}>
            <option value="all">All facilities</option>
            {facilities.data.map((f: Row) => (
              <option key={text(f.id, '')} value={text(f.id, '')}>
                {text(f.name)}
              </option>
            ))}
          </select>
        </label>

        {facilities.isError && <small className="filter-note">Facility list needs the warehouse API.</small>}
      </div>

      <div className="chart-grid">
        <Report
          title="Shipment throughput"
          subtitle="Completed shipments per period"
          state={throughput}
        >
          <TrendChart
            data={throughput.data}
            xKey="period"
            kind="bar"
            stacked
            series={THROUGHPUT_SERIES}
            height={280}
            emptyTitle="No throughput data"
            emptyText="Connect a reporting source to see completed shipments per period."
          />
        </Report>

        <Report
          title="On-time performance"
          subtitle="Share of shipments meeting the promised window"
          state={onTime}
        >
          <TrendChart
            data={onTime.data}
            xKey="period"
            kind="line"
            series={ON_TIME_SERIES}
            height={280}
            emptyTitle="No performance data"
            emptyText="On-time rate appears once delivery events are recorded."
          />
        </Report>

        <Report
          title="Mode mix"
          subtitle="Shipments by transport mode"
          state={modeMix}
        >
          <TrendChart
            data={modeMix.data}
            xKey="name"
            kind="pie"
            series={MODE_MIX_SERIES}
            height={280}
            emptyTitle="No mode data"
            emptyText="Mode mix appears once shipments are tagged with a transport mode."
          />
        </Report>
      </div>
    </>
  );
}

/**
 * A chart panel.
 *
 * Loading gets a chart-shaped skeleton so the page does not reflow when series
 * arrive. Errors are intercepted here, but an empty-but-successful response is
 * deliberately passed through to the chart, which has its own "no data" panel
 * with wording specific to the report. Routing empty through ResourceState as
 * well would show two competing empty messages in the same card.
 */
/** Props for {@link Report}. */
interface ReportProps {
  title: string;
  subtitle: string;
  state: UseCollectionResult;
  children: ReactNode;
}

function Report({ title, subtitle, state, children }: ReportProps) {
  return (
    <section className="panel report">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {state.isLoading ? (
        <div className="chart-skeleton" aria-busy="true" aria-live="polite">
          <span className="skeleton skeleton-block" style={{ height: 240 }} />
        </div>
      ) : state.isError ? (
        <div className="empty-state is-inline" role="alert">
          <b>{state.missingSource ? 'No reporting source connected' : 'Could not load this report'}</b>
          <span>
            {state.missingSource
              ? 'This series has no endpoint behind it yet, so there is nothing to plot.'
              : state.error?.message}
          </span>
          <button type="button" className="button" onClick={state.refetch}>
            Try again
          </button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
