/**
 * Copy and data for the scrollable half of the landing page.
 *
 * Kept in one module so the sections stay presentational and the wording can be
 * reviewed without opening a component. The capability list mirrors the backend
 * domain modules one-to-one: fleet, shipment, warehouse, transport,
 * notifications and auth.
 */

/** A top navigation entry: an in-page anchor, or a real route. */
export interface NavLink {
  /** In-page anchor target, when present. */
  id?: string;
  /** Route to navigate to, when present. */
  path?: string;
  label: string;
}

/** A headline statistic. */
export interface Metric {
  value: string;
  label: string;
  note: string;
}

/** One step of the four-step runtime loop. */
export interface WorkflowStep {
  step: string;
  title: string;
  body: string;
}

/** A product capability, mirroring one backend domain module. */
export interface Capability {
  /** Name of the lucide-react icon. */
  icon: string;
  title: string;
  body: string;
  domain: string;
}

/** A pricing tier. `annual`/`annualCadence` are absent on custom plans. */
export interface Plan {
  name: string;
  price: string;
  monthly: boolean;
  annual?: string;
  annualCadence?: string;
  cadence: string;
  summary: string;
  features: string[];
  cta: string;
  featured: boolean;
}

/** A comparison row on the pricing page. */
export interface PricingTier {
  label: string;
  body: string;
}

/** A question-and-answer pair. */
export interface PricingFaq {
  q: string;
  a: string;
}

/** A footer link group. */
export interface FooterColumn {
  title: string;
  links: string[];
}

export const NAV_LINKS: NavLink[] = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'metrics', label: 'Results' },
  { path: '/pricing', label: 'Pricing' }
];

export const METRICS: Metric[] = [
  { value: '2.3s', label: 'Average incident detection', note: 'From signal received to team alerted' },
  { value: '98.7%', label: 'On-time delivery rate', note: 'Across managed fleet networks' },
  { value: '12,000+', label: 'Vehicles tracked live', note: 'Sub-second GPS resolution' },
  { value: '4', label: 'Systems unified', note: 'One pane of glass replaces four tools' }
];

/** The fragmentation the hero animation dramatises, stated plainly. */
/** The four-step runtime loop. Mirrors the five-act hero narrative. */
export const WORKFLOW: WorkflowStep[] = [
  {
    step: '01',
    title: 'Connect',
    body: 'Point LogiCraft at your fleet, shipment, warehouse and transport feeds. Nothing is rebuilt — the existing sources become one live model.'
  },
  {
    step: '02',
    title: 'Detect',
    body: 'Position, telemetry and schedule data are checked continuously. Route deviations, delays and equipment faults surface the moment they happen.'
  },
  {
    step: '03',
    title: 'Decide',
    body: 'Every alert is scored by severity and routed to the dispatcher, driver or customer who can act on it. Signal, not noise.'
  },
  {
    step: '04',
    title: 'Resolve',
    body: 'Dispatch a backup, recalculate the route, notify the customer and record the outcome — all from the same control tower.'
  }
];

export const CAPABILITIES: Capability[] = [
  {
    icon: 'Zap',
    title: 'Real-time incident detection',
    body: 'IoT sensors and live position data detect route deviations, crashes and delays the moment they happen — no manual checks, no overnight batch sync.',
    domain: 'Shipment'
  },
  {
    icon: 'Navigation',
    title: 'Live fleet tracking',
    body: 'Every vehicle, driver and shipment on a single live map with sub-second GPS resolution and traffic overlays.',
    domain: 'Fleet'
  },
  {
    icon: 'Bell',
    title: 'Smart alert routing',
    body: 'Alerts are triaged by severity and pushed to the right dispatcher, driver or customer. Nobody gets paged for a non-event.',
    domain: 'Notifications'
  },
  {
    icon: 'Warehouse',
    title: 'Warehouse intelligence',
    body: 'Inventory tracking, zone management, inbound and outbound scheduling, and capacity planning — joined to the fleet that serves it.',
    domain: 'Warehouse'
  },
  {
    icon: 'BarChart3',
    title: 'Analytics and reporting',
    body: 'Fleet utilisation, on-time rates, fuel cost and SLA compliance, visualised in real time and exportable when the shift is over.',
    domain: 'Common'
  },
  {
    icon: 'Route',
    title: 'Public transport suite',
    body: 'Schedule management, station dashboards, ticketing and live passenger-load monitoring for transit operators.',
    domain: 'Transport'
  }
];

/* ------------------------------------------------------------------- plans --- */

/**
 * Placeholder pricing for the dedicated /pricing page. The figures are invented
 * — replace them with real packaging before this goes live.
 */
export const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: '$290',
    monthly: true,
    annual: '$235',
    annualCadence: 'per month, billed annually',
    cadence: 'per month',
    summary: 'For a single site getting off spreadsheets.',
    features: ['Up to 25 vehicles', 'Shipment and warehouse modules', 'Email alert routing', 'Community support'],
    cta: 'Start free trial',
    featured: false
  },
  {
    name: 'Growth',
    price: '$890',
    monthly: true,
    annual: '$730',
    annualCadence: 'per month, billed annually',
    cadence: 'per month',
    summary: 'For multi-site teams running a live fleet.',
    features: [
      'Up to 250 vehicles',
      'All six domain modules',
      'Real-time alert routing with severity triage',
      'Analytics and scheduled exports',
      'Priority support'
    ],
    cta: 'Start free trial',
    featured: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    monthly: false,
    cadence: 'annual agreement',
    summary: 'For networks with compliance and scale requirements.',
    features: [
      'Unlimited vehicles and sites',
      'SSO and role-based access',
      'Custom data retention',
      'Dedicated success engineer',
      '99.9% uptime SLA'
    ],
    cta: 'Talk to sales',
    featured: false
  }
];

/** Side-by-side on what actually gates each tier, rather than a feature matrix. */
export const PRICING_TIERS: PricingTier[] = [
  {
    label: 'Vehicle limits',
    body: 'Starter caps at 25 vehicles, Growth at 250. Enterprise is uncapped and priced on active vehicles, so dormant ones do not count.'
  },
  {
    label: 'Alerting depth',
    body: 'Starter sends email. Growth adds severity triage and real-time push. Enterprise adds custom routing rules and on-call escalation.'
  },
  {
    label: 'Data retention',
    body: '90 days of history on Growth, unlimited on Enterprise. Starter keeps 30 days, which is enough for weekly reviews.'
  },
  {
    label: 'Access control',
    body: 'Email and password on the first two tiers. Enterprise adds SSO, SCIM provisioning and per-role permissions down to the field.'
  }
];

export const PRICING_FAQS: PricingFaq[] = [
  {
    q: 'Is there a free trial?',
    a: 'Fourteen days on Growth, no card required. You keep the data you connect, and nothing is deleted if you let the trial lapse.'
  },
  {
    q: 'What counts as a vehicle?',
    a: 'A vehicle with a live position feed in the last 30 days. Trailers and stationary equipment are free, and a vehicle that has been decommissioned stops counting immediately.'
  },
  {
    q: 'Do you charge per seat?',
    a: 'No. Dispatchers, drivers and warehouse staff are unlimited on every tier. You are never billed for inviting a partner to view a shipment.'
  },
  {
    q: 'What happens when we outgrow a plan?',
    a: 'Nothing breaks. Vehicles above the cap keep reporting and are marked as overage, so you can move up at the end of the term without losing visibility in the meantime.'
  },
  {
    q: 'Can we change plans mid-term?',
    a: 'Upgrades apply immediately and are prorated. Downgrades take effect at the next renewal so you keep what you have already paid for.'
  }
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Platform',
    links: ['Incident detection', 'Fleet tracking', 'Alert routing', 'Warehouse intelligence', 'Analytics']
  },
  {
    title: 'Solutions',
    links: ['Freight and 3PL', 'Last-mile delivery', 'Public transport', 'Warehouse operations']
  },
  {
    title: 'Resources',
    links: ['Documentation', 'API reference', 'System status', 'Release notes']
  }
];

export const FOOTER_LEGAL: string[] = ['Privacy', 'Terms', 'Security'];
