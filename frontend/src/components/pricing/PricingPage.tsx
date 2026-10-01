import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LandingNav } from '../landing/LandingNav';
import { Reveal } from '../landing/Reveal';
import { LandingFooter } from '../landing/LandingFooter';
import { PLANS, PRICING_FAQS, PRICING_TIERS } from '../landing/landing.constants';
import type { Plan } from '../landing/landing.constants';
import './pricing.css';

/**
 * Dedicated pricing page at /pricing.
 *
 * Kept out of the landing page deliberately: pricing is a long, comparison-
 * heavy read, and folding it into the marketing scroll would have interrupted
 * the hero narrative. It gets its own route so it can be linked to directly
 * and revisited without re-scrolling the landing page.
 */
/** Props for {@link PricingPage}. */
export interface PricingPageProps {
  onEnterApp: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export function PricingPage({ onEnterApp, onSignIn, onSignUp }: PricingPageProps) {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);

  // The "Custom" tier has no numeric price, so there is nothing to discount.
  const priceFor = (plan: Plan) => {
    if (!annual || !plan.monthly) return plan.price;
    return plan.annual ?? plan.price;
  };

  return (
    <div className="landing-page pricing-page" id="top">
      <LandingNav
        onEnterApp={onEnterApp}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        variant="compact"
      />

      <main className="pricing-main">
        <Reveal className="pricing-head">
          <span className="lp-eyebrow">Pricing</span>
          <h1 className="pricing-title">Priced per site, not per incident.</h1>
          <p className="pricing-lede">
            Every plan includes the full control tower &mdash; fleet, shipments, warehouses and transport in one live
            model. What changes is how many vehicles you run and how deep the alerting goes.
          </p>
        </Reveal>

        <Reveal className="pricing-toggle" delay={80}>
          <div className="pricing-toggle-group" role="group" aria-label="Billing period">
            <button
              type="button"
              className={annual ? '' : 'is-active'}
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
            >
              Monthly
            </button>
            <button
              type="button"
              className={annual ? 'is-active' : ''}
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
            >
              Annual
              <span>Save 18%</span>
            </button>
          </div>
          <p className="pricing-toggle-note">All prices in USD. No per-seat charge for drivers and dispatchers.</p>
        </Reveal>

        <div className="lp-plans">
          {PLANS.map((plan, i) => (
            <Reveal as="article" key={plan.name} delay={i * 90} className={`lp-plan ${plan.featured ? 'is-featured' : ''}`}>
              {plan.featured && <span className="lp-plan-flag">Most popular</span>}
              <h2 className="lp-plan-name">{plan.name}</h2>
              <p className="lp-plan-price">
                <b>{priceFor(plan)}</b>
                <span>{annual && plan.monthly ? plan.annualCadence : plan.cadence}</span>
              </p>
              <p className="lp-plan-summary">{plan.summary}</p>
              <ul className="lp-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                className={`lp-btn ${plan.featured ? 'lp-btn-primary' : ''} lp-plan-cta`}
                type="button"
                onClick={() => navigate('/signup')}
              >
                {plan.cta}
                <ArrowRight size={15} />
              </button>
            </Reveal>
          ))}
        </div>

        <Reveal className="pricing-tiers" delay={120}>
          <h2 className="pricing-subtitle">What separates the tiers</h2>
          <div className="pricing-tiers-grid">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.label} className="pricing-tier">
                <b>{tier.label}</b>
                <p>{tier.body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="pricing-faq" delay={140}>
          <h2 className="pricing-subtitle">Common questions</h2>
          <dl>
            {PRICING_FAQS.map((faq) => (
              <div key={faq.q} className="pricing-faq-item">
                <dt>{faq.q}</dt>
                <dd>{faq.a}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal className="pricing-closer" delay={160}>
          <h2>Not sure which tier fits?</h2>
          <p>Tell us your fleet size and we&rsquo;ll map it to a plan. No sales call required.</p>
          <div className="pricing-closer-actions">
            <Link className="lp-btn lp-btn-primary" to="/signup">
              Create an account
              <ArrowRight size={15} />
            </Link>
            <Link className="lp-btn" to="/">
              Back to overview
            </Link>
          </div>
        </Reveal>
      </main>

      <LandingFooter onEnterApp={onEnterApp} />
    </div>
  );
}
