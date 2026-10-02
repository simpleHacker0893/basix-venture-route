/**
 * Screen 1, the refined UI (design/refined-ui, screen 01) over the section structure of the Stitch
 * export design/stitch/batch-2/landing-page (D-36): hero, How it works, Evidence, For builders.
 * Every name, skill, rate and fact shown is a seed fact (AGENTS.md rule 10); the preview shows no
 * per-builder day rates because the landing page does not compute a route.
 */
import type { EvidenceType } from "@venture-route/contracts";
import { ArrowRight, Check, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { RollingNumber } from "../../components/RollingNumber";
import { EvidenceBadge, StatusBadge } from "../route/Badges";
import { HackathonPartners } from "./HackathonPartners";

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

type PreviewBuilder = Readonly<{
  id: string;
  name: string;
  skill: string;
  evidence: EvidenceType;
  /** The lead source fact behind each rule, verbatim from the engine's reasoning path. */
  facts: Readonly<{ verified: string; available: string; mode: string }>;
}>;

/**
 * Seed facts for the Health pilot route (seed/facts.metta, brief-health-01): feasible, USD 370 of
 * 400. Each fact is copied from the builder's eligible-builder path as the engine returns it.
 */
const AMINA: PreviewBuilder = {
  id: "amina-otieno",
  name: "Amina Otieno",
  skill: "Python",
  evidence: "both",
  facts: {
    verified: "(earned amina-otieno cred-py-201)",
    available: "(available amina-otieno 2026-09-20 2026-10-10)",
    mode: "(supports-mode amina-otieno hybrid)",
  },
};
const PREVIEW_TEAM: ReadonlyArray<PreviewBuilder> = [
  AMINA,
  {
    id: "daniel-kiptoo",
    name: "Daniel Kiptoo",
    skill: "AI / MeTTa",
    evidence: "both",
    facts: {
      verified: "(earned daniel-kiptoo cred-metta-101)",
      available: "(available daniel-kiptoo 2026-09-22 2026-10-03)",
      mode: "(supports-mode daniel-kiptoo hybrid)",
    },
  },
  {
    id: "grace-wambui",
    name: "Grace Wambui",
    skill: "UI/UX",
    evidence: "credential",
    facts: {
      verified: "(earned grace-wambui cred-ux-110)",
      available: "(available grace-wambui 2026-09-15 2026-09-30)",
      mode: "(supports-mode grace-wambui hybrid)",
    },
  },
];
const PREVIEW_TOTAL = 370;
const PREVIEW_BUDGET = 400;

/**
 * The hero's route preview: the team, and for the selected builder the three rules and the fact
 * behind each that make them an eligible-builder. Choosing "Why" on a row swaps the panel.
 */
function RoutePreview() {
  const [selectedId, setSelectedId] = useState(AMINA.id);
  const selected = PREVIEW_TEAM.find((builder) => builder.id === selectedId) ?? AMINA;
  const steps: ReadonlyArray<[string, string]> = [
    ["verified-for-skill", selected.facts.verified],
    ["available-for-brief", selected.facts.available],
    ["mode-compatible", selected.facts.mode],
  ];
  return (
    <div className="rounded-3xl border border-[#d9e5de] bg-sage p-3 sm:p-6">
      <div className="overflow-hidden rounded-xl border border-border bg-surface-strong shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-4 pb-3.5 pt-4 sm:flex-nowrap sm:px-5 lg:flex-wrap xl:flex-nowrap">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">Route · brief-health-01</span>
            <span className="whitespace-nowrap font-display text-[20px] leading-tight text-ink">Your route through BASIX</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status="feasible" />
            <DemoDataPill tone="strong" />
          </div>
        </div>

        <ul aria-label="Team" className="border-t border-border">
          {PREVIEW_TEAM.map((builder) => {
            const active = builder.id === selected.id;
            return (
              <li key={builder.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 sm:px-5">
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold transition-colors ${active ? "bg-accent-green text-white" : "bg-sage text-accent-green"}`}
                >
                  {initials(builder.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="text-[13.5px] font-semibold text-ink">{builder.name}</span>
                  <span className="text-[12px] text-ink-3">{builder.skill}</span>
                </span>
                <span className="hidden sm:inline-flex">
                  <EvidenceBadge evidence={builder.evidence} />
                </span>
                <button
                  type="button"
                  aria-expanded={active}
                  aria-controls="hero-why-panel"
                  aria-label={`Why ${builder.name}`}
                  onClick={() => setSelectedId(builder.id)}
                  className={`-my-1 inline-flex min-h-11 sm:min-h-9 items-center gap-0.5 rounded-md px-1.5 text-[12.5px] transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40 ${active ? "font-semibold text-accent-green" : "font-medium text-ink-3"}`}
                >
                  Why
                  {active ? (
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div id="hero-why-panel" aria-live="polite" className="bg-ink px-4 pb-4 pt-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f3f1ea]">
              Why {selected.name}
            </span>
            <span className="text-[11.5px] text-[#a7b8b0]">Rules and facts only · no model text</span>
          </div>
          <ol className="overflow-hidden rounded-lg border border-white/10 font-mono text-[11.5px]">
            {steps.map(([rule, fact]) => (
              <li
                key={rule}
                className="grid grid-cols-[16px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 border-b border-white/10 px-3 py-2.5 sm:grid-cols-[16px_140px_minmax(0,1fr)]"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5 self-center text-accent-on-dark" strokeWidth={2.5} />
                <span className="text-accent-on-dark">{rule}</span>
                <span title={fact} className="col-start-2 min-w-0 break-words text-[#a7b8b0] sm:col-start-3 sm:truncate">
                  {fact}
                </span>
              </li>
            ))}
            <li className="grid grid-cols-[16px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 bg-accent-green/25 px-3 py-2.5 sm:grid-cols-[16px_140px_minmax(0,1fr)]">
              <Check aria-hidden="true" className="h-3.5 w-3.5 self-center text-accent-on-dark" strokeWidth={2.5} />
              <span className="font-semibold text-accent-on-dark">eligible-builder</span>
              <span className="col-start-2 font-sans text-[11.5px] text-[#f3f1ea] sm:col-start-3">
                follows from the three rules above
              </span>
            </li>
          </ol>
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11.5px] text-[#a7b8b0]">
              Team USD {PREVIEW_TOTAL} of {PREVIEW_BUDGET} / day
            </span>
            <Link
              to="/route"
              className="-my-2 inline-flex items-center gap-1 py-2 text-[12px] font-semibold text-accent-on-dark hover:underline"
            >
              Open full reasoning
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <Section
      id="hero"
      className="mx-auto flex w-full max-w-[1200px] flex-col justify-center px-6 pb-20 pt-14 lg:min-h-[calc(100svh-4rem)] lg:py-16"
    >
      <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent-green">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            Team routing for BASIX
            <span aria-hidden="true" className="text-ink-subtle">/</span>
            <span className="text-ink-3">Decided by MeTTa rules</span>
          </span>
          <h1 className="mt-6 font-display text-[52px] font-normal leading-[1.02] tracking-[-0.03em] text-ink sm:text-[62px] lg:text-[70px]">
            A founding team you can <em className="italic text-accent-green">verify.</em>
          </h1>
          <p className="mt-7 max-w-[520px] text-[17px] leading-[1.65] text-ink-2">
            Describe your MVP in a paragraph. Named MeTTa rules over verified facts choose the smallest team,
            reusable IP, cohort and partner that can build it, and every match shows its evidence. If it
            can&rsquo;t be done, you see the gap, not a guess.
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
          <p className="mt-5 flex items-start gap-2 text-[12.5px] leading-snug text-ink-3">
            <ShieldCheck aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-ink-subtle" strokeWidth={2} />
            A language model helps you write the brief. It never picks the people.
          </p>
          <dl className="mt-8 grid max-w-[480px] grid-cols-[1.3fr_1fr_1fr] items-end gap-x-4 border-t border-border pt-7">
            {(
              [
                [0, "unexplained matches", true],
                [7, "named MeTTa rules", false],
                [181, "seed graph facts", false],
              ] as const
            ).map(([value, label, lead], index) => (
              <div key={label} className="flex flex-col-reverse gap-1.5">
                <dt className={`text-[12px] leading-snug sm:text-[12.5px] ${lead ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {label}
                </dt>
                <dd
                  className={`font-display leading-none tracking-[-0.02em] ${lead ? "text-[40px] text-accent-green sm:text-[48px]" : "text-[24px] text-ink sm:text-[28px]"}`}
                >
                  <RollingNumber value={value} delay={200 + index * 140} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="w-full">
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
      <HackathonPartners />
    </div>
  );
}
