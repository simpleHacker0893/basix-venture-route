/**
 * Screen 1, the refined UI (design/refined-ui, screen 01) over the section structure of the Stitch
 * export design/stitch/batch-2/landing-page (D-36): hero, How it works, Evidence, For builders.
 * Every name, skill, rate and fact shown is a seed fact (AGENTS.md rule 10); the preview shows no
 * per-builder day rates because the landing page does not compute a route.
 */
import type { EvidenceType } from "@venture-route/contracts";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { RollingNumber } from "../../components/RollingNumber";
import { EvidenceBadge, StatusBadge } from "../route/Badges";

type SectionProps = Readonly<{ id: string; className?: string; children: React.ReactNode }>;

function Section({ id, className = "", children }: SectionProps) {
  return (
    <section id={id} data-testid={`landing-section-${id}`} data-section={id} className={`scroll-mt-16 ${className}`}>
      {children}
    </section>
  );
}

function Eyebrow({ children, onDark = false }: Readonly<{ children: React.ReactNode; onDark?: boolean }>) {
  return (
    <span
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.1em] ${onDark ? "text-accent-on-dark" : "text-accent-green"}`}
    >
      {children}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

/** Seed facts for the Health pilot route (seed/facts.metta, brief-health-01): feasible, USD 370 of 400. */
const PREVIEW_TEAM: ReadonlyArray<{ name: string; skill: string; dayRate: number; evidence: EvidenceType }> = [
  { name: "Amina Otieno", skill: "Python", dayRate: 120, evidence: "both" },
  { name: "Daniel Kiptoo", skill: "AI / MeTTa", dayRate: 150, evidence: "both" },
  { name: "Grace Wambui", skill: "UI/UX", dayRate: 100, evidence: "credential" },
];
const PREVIEW_BUDGET = 400;
const PREVIEW_TOTAL = PREVIEW_TEAM.reduce((sum, builder) => sum + builder.dayRate, 0);
const PREVIEW_COVERS = ["Verified team", "Reusable IP", "Cohort", "Partner"];
/** The four rules that make up eligible-builder for every selected builder. */
const PREVIEW_RULES = ["verified-for-skill", "mode-compatible", "available-for-brief", "eligible-builder"];

/**
 * The hero's route preview: header with status, what the route covers, the team on a route rail
 * with day rates and evidence, spend against the ceiling, then the rules that passed on ink.
 */
function RoutePreview() {
  return (
    <figure className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-surface-strong shadow-card">
        <div className="flex flex-col gap-1 px-5 pb-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
              Route · brief-health-01
            </span>
            <StatusBadge status="feasible" />
            <DemoDataPill tone="strong" />
          </div>
          <span className="mt-1.5 font-display text-[22px] leading-tight text-ink">Your route through BASIX</span>
          <span className="text-[12.5px] text-ink-3">Python · AI / MeTTa · UI/UX · three builders</span>
          <ul aria-label="Route covers" className="mt-3 flex flex-wrap gap-2">
            {PREVIEW_COVERS.map((item) => (
              <li
                key={item}
                className="inline-flex items-center gap-1.5 rounded-pill border border-accent-green/70 bg-surface-strong px-2.5 py-[3px] text-[12px] font-medium text-accent-green"
              >
                <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative border-t border-border bg-surface">
          <span aria-hidden="true" className="absolute bottom-7 left-[27px] top-7 w-px bg-accent-green/40" />
          <ul aria-label="Team">
            {PREVIEW_TEAM.map((builder) => (
              <li
                key={builder.name}
                className="relative flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-3 pl-[46px] pr-5 last:border-b-0 sm:flex-nowrap"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-[23px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full border-[1.5px] border-accent-green bg-surface-strong"
                />
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage text-[11.5px] font-semibold text-accent-green">
                  {initials(builder.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-[13.5px] font-semibold text-ink">{builder.name}</span>
                  <span className="mt-0.5 text-[12px] text-ink-3">{builder.skill}</span>
                </span>
                <span className="order-last w-full whitespace-nowrap pl-11 font-mono text-[12px] text-ink-2 sm:order-none sm:w-auto sm:pl-0">
                  USD {builder.dayRate} / day
                </span>
                <EvidenceBadge evidence={builder.evidence} />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border px-5 pb-4 pt-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="whitespace-nowrap font-mono text-ink">
              <span className="text-[19px]">USD {PREVIEW_TOTAL}</span>{" "}
              <span className="text-[11.5px] text-ink-3">of {PREVIEW_BUDGET} / day</span>
            </span>
            <span className="whitespace-nowrap text-[12px] font-semibold text-ink">
              USD {PREVIEW_BUDGET - PREVIEW_TOTAL} under budget
            </span>
          </div>
          <span aria-hidden="true" className="h-1 w-full overflow-hidden rounded-pill bg-border">
            <span
              className="block h-full rounded-pill bg-accent-green"
              style={{ width: `${(PREVIEW_TOTAL / PREVIEW_BUDGET) * 100}%` }}
            />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 bg-ink px-5 py-3.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#a7b8b0]">Rules passed</span>
          {PREVIEW_RULES.map((rule) => (
            <span
              key={rule}
              className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 px-2.5 py-[3px] font-mono text-[11px] text-accent-on-dark"
            >
              <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
              {rule}
            </span>
          ))}
          <Link
            to="/route"
            className="-my-2 ml-auto inline-flex items-center gap-1 py-2 text-[12px] font-semibold text-accent-on-dark hover:underline"
          >
            Why this route?
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <figcaption className="px-1 text-[12px] leading-relaxed text-ink-3">
        Every card built from seed records carries the Demo data mark. Real routes show your real builders.
      </figcaption>
    </figure>
  );
}

const HERO_PROMISES = ["Every match explained", "Honest gaps, never padded", "Deterministic MeTTa rules"];

function Hero() {
  return (
    <Section id="hero" className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-14 lg:pt-20">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-2 self-start rounded-pill border border-border bg-surface-strong px-3.5 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-accent-green">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            Team routing for the BASIX ecosystem
          </span>
          <h1 className="mt-7 font-display text-[52px] font-normal leading-[1.02] tracking-[-0.03em] text-ink sm:text-[62px] lg:text-[70px]">
            The smallest <em className="italic text-accent-green">credible</em> route through BASIX.
          </h1>
          <p className="mt-7 max-w-[520px] text-[17px] leading-[1.65] text-ink-2">
            Describe your MVP in a paragraph. Venture Route assembles the smallest verified team, reusable
            IP, a cohort and a partner, and shows the evidence behind every match. When it cannot be done,
            it says so.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/route"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent-green px-5 text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
            >
              Route my venture
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              to="/route"
              className="inline-flex h-12 items-center rounded-lg border border-border-strong bg-surface-strong px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink-subtle"
            >
              See a demo route
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-ink-3">
            {HERO_PROMISES.map((promise) => (
              <li key={promise} className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-ink-subtle" strokeWidth={2.25} />
                {promise}
              </li>
            ))}
          </ul>
          <dl className="mt-8 grid max-w-[480px] grid-cols-3 gap-x-4 border-t border-border pt-7">
            {(
              [
                [7, "named MeTTa rules", "text-ink"],
                [181, "seed graph facts", "text-ink"],
                [0, "unexplained matches", "text-accent-green"],
              ] as const
            ).map(([value, label, tone], index) => (
              <div key={label} className="flex flex-col-reverse justify-end gap-1">
                <dt className="text-[12px] leading-snug text-ink-3 sm:text-[12.5px]">{label}</dt>
                <dd className={`font-display text-[30px] leading-none sm:text-[36px] tracking-[-0.02em] ${tone}`}>
                  <RollingNumber value={value} delay={200 + index * 140} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="w-full lg:pt-1">
          <RoutePreview />
        </div>
      </div>
    </Section>
  );
}

const STAGES = [
  {
    stage: "01",
    title: "Describe your MVP in plain language",
    body: "Tell the intake assistant what you are building, your budget ceiling, and target timeline in ordinary founder words.",
    foot: "Plain language parsed into facts",
  },
  {
    stage: "02",
    title: "Confirm the brief we extracted",
    body: "Review the structured scope, required technical skills, and constraints before any evaluation rule runs.",
    foot: "python · ai-metta · ui-ux",
  },
  {
    stage: "03",
    title: "Get a route decided by MeTTa rules, with evidence",
    body: "Receive deterministic builder matches, cohort links, and reusable assets — or clear, actionable gaps if unfeasible.",
    foot: "eligible-builder ⇐ source facts",
  },
];

function HowItWorks() {
  return (
    <Section id="how-it-works" className="w-full border-y border-border bg-surface px-6 py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="max-w-2xl font-display text-4xl font-normal leading-[1.1] tracking-[-0.02em] text-ink lg:text-[46px]">
              From a paragraph to a team, in three steps.
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink-3">
            The rules make every decision. The language model only translates your words and explains the result.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STAGES.map((item) => (
            <article
              key={item.stage}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-7 transition-shadow hover:shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-green font-mono text-[12px] font-medium text-white">
                  {item.stage}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
              </div>
              <h3 className="font-display text-[23px] font-normal leading-tight text-ink">{item.title}</h3>
              <p className="flex-1 text-[15px] leading-relaxed text-ink-2">{item.body}</p>
              <div className="rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[12px] text-ink-3">
                {item.foot}
              </div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Seed facts for the evidence sample, as named rule steps. */
const EVIDENCE_LINES: ReadonlyArray<{ kind: "Rule" | "Fact"; text: string }> = [
  { kind: "Rule", text: "verified-for-skill" },
  { kind: "Fact", text: "(earned amina-otieno cred-py-201)" },
  { kind: "Fact", text: "(proves cred-py-201 python)" },
  { kind: "Rule", text: "available-for-brief" },
  { kind: "Fact", text: "(available amina-otieno 2026-09-20 2026-10-10)" },
];

function Evidence() {
  return (
    <Section id="evidence" className="w-full bg-dark px-6 py-24 text-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5">
          <Eyebrow onDark>For judges and founders alike</Eyebrow>
          <h2 className="font-display text-4xl font-normal leading-[1.1] tracking-[-0.02em] text-white lg:text-[46px]">
            Every recommendation names its rule and its facts.
          </h2>
          <p className="text-lg leading-relaxed text-[#a7b8b0]">
            No black-box hallucinations. Every match and recommendation is justified by inspectable
            first-order logic over verified credentials, project records, and cohort registries.
          </p>
          <ul className="flex flex-col gap-3 text-[15px] text-[#f3f1ea]">
            {[
              "Inspectable multi-hop proof chains",
              "Explicit gaps when skills or availability fall short",
              "Full audit trail exportable for stakeholder handoff",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent-on-dark" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border-dark bg-surface-dark-card font-mono text-[12.5px]">
          <div className="flex items-center gap-2 border-b border-border-dark px-5 py-3.5">
            {[0, 1, 2].map((dot) => (
              <span key={dot} aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-border-dark" />
            ))}
            <span className="ml-auto text-[#a7b8b0]">reasoning-path · amina-otieno × python</span>
          </div>
          <div className="flex flex-col gap-3 px-6 py-6">
            {EVIDENCE_LINES.map((line) => (
              <div key={line.text} className="flex gap-4">
                <span
                  className={`w-11 shrink-0 text-[10.5px] font-medium uppercase tracking-[0.1em] leading-[1.9] ${line.kind === "Rule" ? "text-accent-on-dark" : "text-[#a7b8b0]"}`}
                >
                  {line.kind}
                </span>
                <span data-testid={line.kind === "Fact" ? "fact" : undefined} className="text-[#f3f1ea]">
                  {line.text}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2.5 rounded-lg bg-accent-green px-3.5 py-3 text-[#f3f1ea]">
              <span aria-hidden="true" className="text-accent-on-dark">⇒</span>
              <span>!(eligible-builder brief-health-01 amina-otieno python)</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ForBuilders() {
  return (
    <Section id="for-builders" className="mx-auto w-full max-w-[1200px] px-6 py-24">
      <div className="mb-10 flex flex-col gap-3">
        <Eyebrow>For builders</Eyebrow>
        <h2 className="font-display text-4xl font-normal leading-[1.1] tracking-[-0.02em] text-ink lg:text-[46px]">
          Get routed for what you can prove.
        </h2>
      </div>
      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
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
          <div key={card.title} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-[23px] font-normal text-ink">{card.title}</h3>
              <span className="rounded-pill bg-sage px-3 py-1 text-[12px] font-medium text-accent-green">{card.badge}</span>
            </div>
            <p className="text-[15px] leading-relaxed text-ink-2">{card.body}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Link
          to="/"
          className="rounded-lg bg-accent-green px-6 py-3 text-center text-base font-medium text-white shadow-card transition-colors hover:bg-accent-green-hover"
        >
          Create a builder profile
        </Link>
        <span className="text-sm text-ink-3">
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
