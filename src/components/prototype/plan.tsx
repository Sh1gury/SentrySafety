'use client';

import { PageHeader, classNames } from './shared';

interface PlanTier {
  id: string;
  name: string;
  price: string;
  cycle?: string;
  limit: string;
  features: string[];
  current?: boolean;
  highlight?: boolean;
  cta: string;
  ctaDisabled?: boolean;
}

interface PlanTierWithHandler extends PlanTier {
  onCta?: () => void;
}

const PLANS: PlanTierWithHandler[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    limit: '500 scans / month',
    features: [
      'Layer 1 — deterministic only',
      'Text and DOCX support',
      '100 MB per scan',
      'Community support',
    ],
    current: true,
    cta: 'Current plan',
    ctaDisabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    cycle: '/ month',
    limit: '10,000 scans / month',
    features: [
      'All 3 security layers',
      'All file types (PDF, ZIP, DOCX)',
      '1 GB per scan',
      'Webhook delivery',
      'Priority support',
    ],
    highlight: true,
    cta: 'Upgrade to Pro',
    onCta: () => { window.location.href = 'mailto:sales@sentry.io?subject=Sentry%20Safety%20Pro%20Upgrade&body=I%27d%20like%20to%20upgrade%20to%20the%20Pro%20plan.' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    limit: 'Unlimited scans',
    features: [
      'Everything in Pro',
      'Dedicated instance',
      'SLA 99.99%',
      'Custom NER models',
      'SSO / SAML',
    ],
    cta: 'Contact sales',
    onCta: () => { window.location.href = 'mailto:sales@sentry.io?subject=Sentry%20Safety%20Enterprise%20Inquiry' },
  },
];

export function PlanPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Subscription"
        title="Choose your plan"
        subtitle="Upgrade to unlock all three security layers and higher scan limits."
      />
      <div className="plan-grid">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={classNames(
              'plan-card',
              plan.highlight && 'highlight',
              plan.current && 'current',
            )}
          >
            {plan.highlight && (
              <div className="plan-card-badge popular">Most popular</div>
            )}
            {plan.current && (
              <div className="plan-card-badge active">Your plan</div>
            )}

            <div>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price" style={{ marginTop: 8 }}>
                {plan.price}
                {plan.cycle && <span className="plan-cycle">{plan.cycle}</span>}
              </div>
              <div className="plan-scans" style={{ marginTop: 6 }}>{plan.limit}</div>
            </div>

            <div className="divider-line" />

            <ul className="plan-features">
              {plan.features.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <button
              className={classNames(
                'btn',
                plan.highlight && !plan.current ? 'btn-primary' : '',
                plan.ctaDisabled && 'btn-disabled',
              )}
              disabled={plan.ctaDisabled}
              onClick={plan.onCta}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', maxWidth: 560 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>All plans include</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
          {[
            'Layer 1 always active',
            'No document storage',
            'PII token maps',
            'Scan audit log',
            'GDPR-ready architecture',
            'REST API',
          ].map(f => (
            <div key={f} style={{ fontSize: 12.5, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 11 }}>✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
