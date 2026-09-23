import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../route/Badges";

type SectionProps = Readonly<{ id: string; className?: string; children: React.ReactNode }>;

function Section({ id, className = "", children }: SectionProps) {
  return (
    <section
      id={id}
      data-testid={`landing-section-${id}`}
      data-section={id}
      className={`w-full ${className}`}
    >
      <div className="mx-auto w-full max-w-[var(--vr-content-max)] px-6">{children}</div>
    </section>
  );
}

/** Screen 1, section 2 (pack prompt 2.1): headline, sub-headline, two buttons, framed route preview. */
function Hero() {
  return (
    <Section id="hero" className="py-16">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-[44px] font-medium leading-[1.1]">
            The smallest credible route through BASIX.
          </h1>
          <p className="max-w-xl text-lg text-ink-2">
            Describe your MVP. Get a verified team, reusable IP, a cohort and a partner, with the
            evidence to trust it. Honest gaps when it cannot be done.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/route">Route my venture</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/route">See a demo route</Link>
            </Button>
          </div>
        </div>
        <div className="relative rounded-card border border-border bg-surface p-6 shadow-drawer">
          <div className="absolute right-4 top-4">
            <DemoDataPill />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="font-display text-xl font-medium">Your route through BASIX</span>
              <StatusBadge status="feasible" />
            </div>
            <div className="font-mono text-sm">
              USD 370 / day <span className="text-ink-3">against USD 400 / day</span>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex justify-between rounded-card border border-border bg-surface-strong px-3 py-2">
                <span>Amina Otieno</span>
                <span className="text-ink-3">Python · Both</span>
              </li>
              <li className="flex justify-between rounded-card border border-border bg-surface-strong px-3 py-2">
                <span>Daniel Kiptoo</span>
                <span className="text-ink-3">AI / MeTTa · Both</span>
              </li>
              <li className="flex justify-between rounded-card border border-border bg-surface-strong px-3 py-2">
                <span>Grace Wambui</span>
                <span className="text-ink-3">UI/UX design · Credential</span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-2 font-mono text-[12px] text-ink-3">
              <span>verified-for-skill</span>
              <span>eligible-builder</span>
              <span>partner-fit</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

const STEPS = [
  {
    title: "1. Describe your MVP in plain language",
    caption: "Tell the intake assistant what you are building, your budget ceiling and your dates in ordinary founder words.",
  },
  {
    title: "2. Confirm the brief we extracted",
    caption: "Review the structured brief, the required skills and the constraints before any rule runs.",
  },
  {
    title: "3. Get a route decided by MeTTa rules, with evidence",
    caption: "Verified builders, reusable IP, a cohort and a partner, or a named gap with only the engine's next actions.",
  },
];

/** Section 3: three numbered step cards. */
function HowItWorks() {
  return (
    <Section id="how-it-works" className="py-16">
      <div className="flex flex-col gap-8">
        <div>
          <span className="text-[13px] uppercase tracking-wider text-ink-3">Workflow</span>
          <h2 className="font-display text-[36px] font-medium">How it works</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.title} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-sm text-ink-2">{step.caption}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}

const EVIDENCE_FACTS = [
  "(earned amina-otieno cred-py-201)",
  "(proves cred-py-201 python)",
  "(confirmed admin-basix cred-py-201)",
];

/** Section 4: the dark "Evidence, not vibes" block with a mono evidence sample. */
function Evidence() {
  return (
    <Section id="evidence" className="bg-dark py-16 text-white">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className="text-[13px] uppercase tracking-wider text-accent-on-dark">Evidence, not vibes</span>
          <h2 className="font-display text-[36px] font-medium leading-tight">
            Every recommendation names its rule and its facts.
          </h2>
          <p className="max-w-xl text-white/80">
            Eligibility, evidence, availability, reuse and partner fit are named MeTTa rules over
            source facts. A language model only translates your words and explains the result.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-white/10 bg-black/30 p-6 font-mono text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-accent-on-dark">rule</span>
            <code className="text-white">eligible-builder</code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-accent-on-dark">facts</span>
            {EVIDENCE_FACTS.map((fact, index) => (
              <code key={fact} data-testid="fact" className="text-white">
                {index + 1}. {fact}
              </code>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-accent-on-dark">conclusion</span>
            <code className="text-white">amina-otieno is eligible for python</code>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Section 5: two builder cards and the secondary call to action (marketplace is Sprint 003). */
function ForBuilders() {
  return (
    <Section id="for-builders" className="py-16">
      <div className="flex flex-col gap-8">
        <div>
          <span className="text-[13px] uppercase tracking-wider text-ink-3">Ecosystem talent</span>
          <h2 className="font-display text-[36px] font-medium">For builders</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
            <h3 className="text-xl font-semibold">Verified profile</h3>
            <p className="text-sm text-ink-2">
              Ground your skills in confirmed credentials and completed projects. Self-described
              skills are shown, never counted as proof.
            </p>
          </article>
          <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
            <h3 className="text-xl font-semibold">Bid where you are eligible</h3>
            <p className="text-sm text-ink-2">
              See the briefs where the eligibility rule already holds for you: skills, mode,
              availability and a confirmed account.
            </p>
          </article>
        </div>
        <div>
          <Button asChild variant="secondary">
            <Link to="/">Create a builder profile</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function LandingPage() {
  return (
    <div className="-mx-6 -my-12">
      <Hero />
      <HowItWorks />
      <Evidence />
      <ForBuilders />
    </div>
  );
}
