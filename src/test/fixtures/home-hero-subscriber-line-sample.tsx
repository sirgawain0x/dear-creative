import { formatActiveSubscriberCount } from "@/lib/subscribers/active-subscriber-count";

/** Test-harness hero slice for local sample screenshots (not used in production routes). */
export function HomeHeroSubscriberLineSample({
  count = 42,
  logoSrc,
}: {
  count?: number;
  logoSrc: string;
}) {
  return (
    <main className="hero-main">
      <div className="hero-row">
        <div className="hero-logo">
          <img src={logoSrc} alt="Dear Creative Mascot Logo" />
        </div>
        <div>
          <p className="eyebrow">Creative Platform Dispatches</p>
          <h1 className="title">Dear Creative</h1>
          <p className="subtitle">
            The publication for autonomous creators, onchain builders, and
            independent founders.
          </p>
          <p className="subscriber-line">
            Join {formatActiveSubscriberCount(count)} creatives reading Dear
            Creative
          </p>
        </div>
      </div>
      <div className="cta-row">
        <span className="cta-secondary">Subscribe Free</span>
      </div>
    </main>
  );
}

export const HOME_HERO_SUBSCRIBER_LINE_SAMPLE_COUNT = 42 as const;
