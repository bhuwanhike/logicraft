import { Activity, BarChart3, Bell, Navigation, Route, Warehouse, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Reveal } from './Reveal';
import { CAPABILITIES, METRICS, WORKFLOW } from './landing.constants';

const ICONS: Record<string, LucideIcon> = { Activity, BarChart3, Bell, Navigation, Route, Warehouse, Zap };

/* ---------------------------------------------------------------- workflow --- */

export function Workflow() {
  return (
    <section className="lp-section lp-section-alt" id="how-it-works">
      <Reveal className="lp-head">
        <span className="lp-eyebrow">How it works</span>
        <h2 className="lp-title">From raw signal to resolved, in one loop.</h2>
        <p className="lp-lede">
          Nothing here is a new process bolted onto your team. It is the same operation you already run, with the gap
          between your systems closed.
        </p>
      </Reveal>

      <ol className="lp-steps">
        {WORKFLOW.map((item, i) => (
          <Reveal as="li" key={item.step} delay={i * 90} className="lp-step">
            <span className="lp-step-index">{item.step}</span>
            <h3 className="lp-step-title">{item.title}</h3>
            <p className="lp-step-body">{item.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------ capabilities --- */

export function Capabilities() {
  return (
    <section className="lp-section" id="capabilities">
      <Reveal className="lp-head">
        <span className="lp-eyebrow">Built for modern logistics</span>
        <h2 className="lp-title">Everything your team needs, in one platform.</h2>
        <p className="lp-lede">
          Six domains, one data model. Each one is useful on its own; together they are the difference between reacting
          to an incident and preventing it.
        </p>
      </Reveal>

      <div className="lp-cards">
        {CAPABILITIES.map((cap, i) => {
          const Icon = ICONS[cap.icon] ?? Activity;
          return (
            <Reveal as="article" key={cap.title} delay={(i % 3) * 90} className="lp-card">
              <span className="lp-card-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h3 className="lp-card-title">{cap.title}</h3>
              <p className="lp-card-body">{cap.body}</p>
              <span className="lp-card-domain">{cap.domain}</span>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- metrics --- */

export function Metrics() {
  return (
    <section className="lp-section lp-section-alt" id="metrics">
      <Reveal className="lp-head">
        <span className="lp-eyebrow">The result</span>
        <h2 className="lp-title">Seconds instead of hours.</h2>
        <p className="lp-lede">
          The measure that matters is not dashboards shipped. It is how long a problem exists before the first person
          who can fix it finds out.
        </p>
      </Reveal>

      <div className="lp-metrics">
        {METRICS.map((metric, i) => (
          <Reveal as="div" key={metric.label} delay={i * 80} className="lp-metric">
            <b className="lp-metric-value">{metric.value}</b>
            <span className="lp-metric-label">{metric.label}</span>
            <small className="lp-metric-note">{metric.note}</small>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
