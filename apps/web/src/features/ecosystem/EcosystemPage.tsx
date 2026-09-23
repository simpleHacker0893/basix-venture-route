/**
 * The page behind the Stitch footer's Ecosystem column (D-36: every footer link lands on a real
 * destination). Four sections, one per link: BASIX, MeTTa OmniUniversity, SingularityNET MeTTa,
 * Partners. Copy is the product's own (README, PRD, DOMAIN.md); every entity, cohort, vertical
 * and partnership is a seed fact the engine reasons over (`lib/ecosystem.ts`, proven against
 * `seed/facts.metta`). No real organisation, person or relationship is represented.
 */
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { METTA_RULES, PARTNERS, UNIVERSITIES, entityName } from "../../lib/ecosystem";

type SectionProps = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  dark?: boolean;
  children: React.ReactNode;
}>;

function Section({ id, eyebrow, title, dark = false, children }: SectionProps) {
  const frame = dark ? "my-8 w-full bg-dark px-6 py-16 text-white" : "mx-auto w-full max-w-[1200px] px-6 py-16";
  return (
    <section id={id} data-testid={`ecosystem-section-${id}`} data-section={id} className={`scroll-mt-16 ${frame}`}>
      <div className="mx-auto max-w-[1200px]">
        <span
          className={`font-mono text-xs uppercase tracking-widest ${dark ? "text-accent-on-dark" : "text-ink-subtle"}`}
        >
          {eyebrow}
        </span>
        <h2 className={`mt-1 font-display text-3xl ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function Fact({ children }: Readonly<{ children: string }>) {
  return <div className="font-mono text-[12px] text-ink-subtle">{children}</div>;
}

const VERTICAL_LABEL = { health: "Health", agri: "Agri", education: "Education" } as const;

export function EcosystemPage() {
  return (
    <div className="pb-8">
      <header className="mx-auto w-full max-w-[1200px] px-6 pb-4 pt-16">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-ink-subtle">ECOSYSTEM</span>
          <DemoDataPill />
        </div>
        <h1 className="mt-2 font-display text-5xl font-normal leading-[1.15] tracking-tight text-ink">
          The BASIX ecosystem
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
          Venture Route turns a founder&apos;s plain-language venture brief into the smallest credible route
          through a BASIX-shaped ecosystem: verified builders, reusable IP, cohort and university context, a
          relevant partner, daily cost, and explicit capability gaps. Everything on this page is fictional
          demo data; no real people, credentials, IP ownership or partner relationships are represented.
        </p>
      </header>

      <Section id="basix" eyebrow="THE REGISTRY" title="BASIX">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: "Records, not a route",
              body: "BASIX holds the ingredients of a venture: verified learning, credentials, builders, completed IP, cohorts, universities and partners. Venture Route turns those records into an actionable, auditable delivery path.",
            },
            {
              title: "Admins keep the graph honest",
              body: "A BASIX admin confirms accounts, credentials and projects. Only confirmed records enter the graph; a rejected or unconfirmed record never makes a builder eligible.",
            },
            {
              title: "Demo data, labelled",
              body: "Every seed-derived and user-entered record in this release carries the amber Demo data label. Real data can replace it later without a redesign.",
            },
          ].map((card) => (
            <article key={card.title} className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-ink">{card.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{card.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="omni" eyebrow="BUILDERS AND COHORTS" title="MeTTa OmniUniversity">
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
          Builders are MeTTa OmniUniversity or BASIX cohort members with a profile, credentials, projects,
          availability and a day rate. A builder belongs to a cohort, and a cohort belongs to a university;
          that chain is how a route reaches a partner. The seed graph holds these universities and cohorts:
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {UNIVERSITIES.map((university) => (
            <li key={university.id} className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="text-base font-semibold text-ink">{entityName(university.id)}</div>
              <div className="mt-1 text-sm text-ink-muted">
                {university.cohorts.map((cohort) => entityName(cohort)).join(", ")}
              </div>
              <div className="mt-4 space-y-1 border-t border-border/60 pt-3">
                {university.cohorts.map((cohort) => (
                  <Fact key={cohort}>{`(cohort-of ${cohort} ${university.id})`}</Fact>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="snet" eyebrow="DETERMINISTIC EVALUATION" title="SingularityNET MeTTa" dark>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-base leading-relaxed text-[#cbd5e1]">
              Venture Route is a hackathon proof of concept for the SingularityNET MeTTa track. Eligibility,
              evidence, availability, mode fit, reuse fit, partner fit and every gap come from named MeTTa
              rules over facts, run in the Hyperon runtime inside the routing engine. A language model
              translates the founder&apos;s words and explains the result; it never selects people, invents
              proof, or claims a route is verified.
            </p>
            <Link
              to="/#evidence"
              className="mt-6 inline-block text-sm font-medium text-accent-on-dark underline decoration-accent-on-dark/40 underline-offset-4 hover:decoration-accent-on-dark"
            >
              See a rule evaluation on the landing page
            </Link>
          </div>
          <div className="rounded-lg border border-[#2c2f36] bg-[#1c1e22] p-5 lg:col-span-6">
            <div className="mb-3 font-mono text-xs uppercase tracking-widest text-accent-on-dark">
              THE SEVEN NAMED RULES
            </div>
            <ul className="space-y-2">
              {METTA_RULES.map((rule) => (
                <li key={rule} className="font-mono text-sm text-[#e2e8f0]">
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="partners" eyebrow="FOUR HOPS" title="Partners">
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
          A partner fits a route when it supports the brief&apos;s vertical and partners with the university whose
          cohort a selected builder belongs to: brief vertical → partner → university → cohort → builder, one
          <span className="font-mono"> partner-fit</span> query. The seed graph holds these partners:
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {PARTNERS.map((partner) => (
            <li key={partner.id} className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-ink">{entityName(partner.id)}</h3>
                <span className="rounded border border-ink-subtle/30 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                  {VERTICAL_LABEL[partner.vertical]}
                </span>
              </div>
              <div className="mt-1 text-sm text-ink-muted">Partners with {entityName(partner.university)}</div>
              <div className="mt-4 space-y-1 border-t border-border/60 pt-3">
                <Fact>{`(supports-vertical ${partner.id} ${partner.vertical})`}</Fact>
                <Fact>{`(partners-with ${partner.id} ${partner.university})`}</Fact>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/route"
            className="rounded-md bg-accent-green px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-green-hover"
          >
            Route my venture
          </Link>
          <Link
            to="/sign-up"
            className="px-4 py-3 text-base font-medium text-ink underline decoration-ink-muted/40 underline-offset-4 hover:text-accent-green hover:decoration-accent-green"
          >
            Create a builder profile
          </Link>
        </div>
      </Section>
    </div>
  );
}
