/**
 * Screen 1, replicated from the Stitch export design/stitch/batch-2/landing-page (D-36: the
 * approved Stitch download wins). Sections, copy, labels and layout follow the export; the only
 * substitutions are seed facts in place of Stitch's invented names and dates, and one strip
 * label that would have claimed cryptography the product does not have.
 */
import { Link } from "react-router";

type SectionProps = Readonly<{ id: string; className?: string; children: React.ReactNode }>;

function Section({ id, className = "", children }: SectionProps) {
  return (
    <section id={id} data-testid={`landing-section-${id}`} data-section={id} className={className}>
      {children}
    </section>
  );
}

/** Stitch hero: 7/5 grid, Fraunces 5xl headline, two calls to action, mono strip, framed route preview. */
function Hero() {
  return (
    <Section id="hero" className="mx-auto w-full max-w-[1200px] px-6 pb-20 pt-16">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="font-display text-5xl font-normal leading-[1.15] tracking-tight text-ink">
            The smallest credible route through BASIX.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            Describe your MVP. Get a verified team, reusable IP, a cohort and a partner, with the
            evidence to trust it. Honest gaps when it cannot be done.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/route"
              className="rounded-md bg-accent-green px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-green-hover"
            >
              Route my venture
            </Link>
            <Link
              to="/route"
              className="flex items-center gap-1.5 px-4 py-3 text-base font-medium text-ink underline decoration-ink-muted/40 underline-offset-4 transition-all hover:text-accent-green hover:decoration-accent-green"
            >
              See a demo route
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2 font-mono text-xs tracking-wide text-ink-subtle">
            <span>DETERMINISTIC EVALUATION</span>
            <span className="opacity-50">·</span>
            <span>INSPECTABLE EVIDENCE</span>
            <span className="opacity-50">·</span>
            <span>MeTTa KNOWLEDGE GRAPH</span>
          </div>
        </div>
        <div className="w-full lg:col-span-5">
          <div className="relative overflow-hidden rounded-lg border border-ledger-dim bg-white p-5 shadow-sm">
            <div className="absolute right-4 top-4 rounded border border-[#fde68a] bg-[#fef3c7] px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-[#92400e]">
              Demo data
            </div>
            <div className="border-b border-[#ece8df] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold text-ink">Your route through BASIX</span>
                <span className="rounded border border-accent-green/30 bg-[#e7f5ee] px-2 py-0.5 font-mono text-[11px] font-medium text-accent-green">
                  Feasible
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-ink-muted">
                USD 370 / day <span className="text-ink-subtle">(Budget ceiling USD 400)</span>
              </div>
            </div>
            <div className="space-y-2.5 py-3">
              {[
                ["Amina Otieno", "Python · Both"],
                ["Daniel Kiptoo", "AI / MeTTa · Both"],
                ["Grace Wambui", "UI/UX · Credential"],
              ].map(([name, role]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded border border-border/60 bg-ground/50 px-2 py-1 text-xs"
                >
                  <span className="font-medium text-ink">{name}</span>
                  <span className="font-mono text-ink-muted">{role}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[#ece8df] pt-3">
              <span className="rounded bg-surface-dark-card px-2 py-0.5 font-mono text-[10px] text-white">verified-for-skill</span>
              <span className="rounded bg-surface-dark-card px-2 py-0.5 font-mono text-[10px] text-white">eligible-builder</span>
              <span className="ml-auto rounded bg-accent-green/10 px-2 py-0.5 font-mono text-[10px] text-accent-green">3/3 Grounded</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

const STAGES = [
  {
    stage: "Stage 01",
    title: "1. Describe your MVP in plain language",
    body: "Tell the intake assistant what you are building, your budget ceiling, and target timeline in ordinary founder words.",
    foot: "Plain language parsed into facts",
  },
  {
    stage: "Stage 02",
    title: "2. Confirm the brief we extracted",
    body: "Review the structured scope, required technical skills, and constraints before any evaluation rule runs.",
    foot: "Deterministic constraint confirmation",
  },
  {
    stage: "Stage 03",
    title: "3. Get a route decided by MeTTa rules, with evidence",
    body: "Receive deterministic builder matches, cohort links, and reusable assets — or clear, actionable gaps if unfeasible.",
    foot: "Zero hallucinations · Full audit ledger",
  },
];

/** Stitch "How it works": WORKFLOW eyebrow, three stage cards with a mono footer line each. */
function HowItWorks() {
  return (
    <Section id="how-it-works" className="mx-auto w-full max-w-[1200px] border-t border-border px-6 py-20">
      <div className="mb-10">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-subtle">WORKFLOW</span>
        <h2 className="mt-1 font-display text-3xl text-ink">How it works</h2>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STAGES.map((item) => (
          <article
            key={item.stage}
            className="flex flex-col justify-between rounded-lg border border-border bg-white p-6 shadow-sm transition-colors hover:border-accent-green/40"
          >
            <div>
              <div className="mb-4 font-mono text-xs uppercase tracking-widest text-ink-subtle">{item.stage}</div>
              <h3 className="mb-3 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </div>
            <div className="mt-6 border-t border-border/60 pt-4 font-mono text-[11px] text-ink-subtle">{item.foot}</div>
          </article>
        ))}
      </div>
    </Section>
  );
}

/** Seed facts for the evidence sample (the Stitch export's dates were not seed facts). */
const EVIDENCE_FACTS = [
  "(earned amina-otieno cred-py-201)",
  "(proves cred-py-201 python)",
  "(available amina-otieno 2026-09-20 2026-10-10)",
];

/** Stitch "Evidence" dark section: eyebrow, headline, paragraph, three check items, the rule card. */
function Evidence() {
  return (
    <Section id="evidence" className="my-8 w-full bg-dark px-6 py-20 text-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <span className="mb-3 block font-mono text-xs uppercase tracking-widest text-accent-on-dark">
            DETERMINISTIC VERIFICATION
          </span>
          <h2 className="mb-4 font-display text-3xl font-normal leading-tight text-white lg:text-4xl">
            Every recommendation names its rule and its facts.
          </h2>
          <p className="mb-6 text-base leading-relaxed text-[#a3a29e]">
            No black-box hallucinations. Every match and recommendation is justified by inspectable
            first-order logic over verified credentials, project records, and cohort registries.
          </p>
          <ul className="space-y-3 text-sm text-[#cbd5e1]">
            {[
              "Inspectable multi-hop proof chains",
              "Explicit gaps when skills or availability fall short",
              "Full audit trail exportable for stakeholder handoff",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="font-mono text-accent-on-dark">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-border-dark bg-surface-dark-card p-6 font-mono text-xs leading-relaxed shadow-lg">
            <div className="flex items-center justify-between border-b border-border-dark pb-3">
              <span className="font-bold tracking-wider text-accent-on-dark">RULE EVALUATION: verified-for-skill</span>
              <span className="rounded border border-accent-on-dark/30 bg-accent-green/40 px-2.5 py-0.5 text-[11px] text-accent-on-dark">
                Pass · Grounded
              </span>
            </div>
            <div className="mt-4 space-y-1.5 text-[#cbd5e1]">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Asserted Ledger Facts:</div>
              {EVIDENCE_FACTS.map((fact, index) => (
                <div key={fact} data-testid="fact" className="font-mono text-[#e2e8f0]">
                  {index + 1}. {fact}
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border-dark pt-3 text-[#cbd5e1]">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">MeTTa Execution Query:</div>
              <div className="font-mono text-[#e2e8f0]">!(eligible-builder brief-health-01 amina-otieno python)</div>
              <div className="mt-2 flex items-center gap-1.5 font-medium text-accent-on-dark">
                <span>✓</span>
                <span>Rule eligible-builder holds by credential and verified calendar window.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Stitch "For builders": ECOSYSTEM TALENT eyebrow, two cards with badges, outlined call to action. */
function ForBuilders() {
  return (
    <Section id="for-builders" className="mx-auto w-full max-w-[1200px] px-6 py-20">
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-subtle">ECOSYSTEM TALENT</span>
        <h2 className="mt-1 font-display text-3xl text-ink">For builders</h2>
      </div>
      <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        {[
          {
            title: "Verified profile",
            badge: "Credential-backed",
            body: "Ground your skills in accredited university cohorts, verified credentials, and completed open projects. No exaggerated resumes — only verifiable work.",
          },
          {
            title: "Bid where you are eligible",
            badge: "Deterministic match",
            body: "Discover venture briefs where deterministic rules confirm you meet the stack requirements, day rate, and delivery timeframe without speculative proposals.",
          },
        ].map((card) => (
          <div key={card.title} className="flex flex-col justify-between rounded-lg border border-border bg-white p-8 shadow-sm">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ink">{card.title}</h3>
                <span className="rounded border border-border bg-ground px-2.5 py-1 font-mono text-xs text-ink-muted">{card.badge}</span>
              </div>
              <p className="text-base leading-relaxed text-ink-muted">{card.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-center">
        <Link
          to="/"
          className="rounded-md border border-accent-green px-6 py-3 text-center text-base font-medium text-accent-green transition-colors hover:bg-accent-green hover:text-white"
        >
          Create a builder profile
        </Link>
        <span className="text-sm text-ink-muted">
          Are you an ecosystem institution or university? Inquire about cohort registry integration.
        </span>
      </div>
    </Section>
  );
}

export function LandingPage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <HowItWorks />
      <Evidence />
      <ForBuilders />
    </div>
  );
}
