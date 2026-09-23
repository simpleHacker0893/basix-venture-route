/**
 * The page behind the Stitch footer's Privacy link (D-36: every footer link lands on a real
 * destination). It states only what the product does with data today, from the repo's own
 * rules: AGENTS.md rule 5 (demo data labelled), D-04 (routing is public), D-06 (LLM adapter),
 * D-03 and the Clerk webhook (what the users row holds), DOMAIN.md §Marketplace rules (contact
 * sharing), D-17 (Neon Postgres) and D-26 (keys in .env). Nothing here claims a capability the
 * product lacks.
 */
const REPO = "https://github.com/simpleHacker0893/basix-venture-route";

type SectionProps = Readonly<{ title: string; children: React.ReactNode }>;

function Section({ title, children }: SectionProps) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-3 max-w-2xl space-y-3 text-base leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-16">
      <span className="font-mono text-xs uppercase tracking-widest text-ink-subtle">HACKATHON PROTOTYPE</span>
      <h1 className="mt-2 font-display text-5xl font-normal leading-[1.15] tracking-tight text-ink">Privacy</h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
        Venture Route is a proof of concept built for the BASIX hackathon, SingularityNET MeTTa track. This
        page says what the prototype stores and sends, and nothing more.
      </p>

      <div className="mt-10">
        <Section title="Demo data">
          <p>
            Every record in this release is fictional demo data, whether it came from the seed graph or was
            typed in through a form, and the interface labels each one with the amber Demo data pill. No real
            people, availability, credentials, IP ownership or partner relationships are represented.
          </p>
        </Section>

        <Section title="Routing without an account">
          <p>
            Routing needs no sign-in. The brief you describe is sent to the routing engine, which decides the
            route with MeTTa rules over the demo graph. When the Operator has configured an Anthropic key,
            the engine sends your brief text to Anthropic to extract the brief&apos;s fields and to write the
            explanation of the finished route; the explanation step receives only the structured route, never
            the graph. Without a key, the structured form does the same job and nothing leaves the engine.
          </p>
        </Section>

        <Section title="Accounts and profiles">
          <p>
            Sign-in is handled by Clerk. The engine keeps one users row per account: the Clerk id, the email
            address, the role you chose (founder or builder) and the confirmation status a BASIX admin sets. A
            builder&apos;s profile, credentials, projects and availability are stored so an admin can confirm
            them; only confirmed records enter the graph. A builder&apos;s email, phone and LinkedIn are shown
            to founders only when the builder turns sharing on for that field.
          </p>
        </Section>

        <Section title="Requests, bids and interviews">
          <p>
            Published requests keep the exact brief and the route the founder saw; bids keep the day rate, the
            message and the engine&apos;s eligibility evidence; interview bookings keep the proposed times and
            every accept, counter and confirm step. These rows live in the project&apos;s Neon Postgres store
            and never enter the graph. There are no payments, no video links and no notifications beyond
            what the screens show.
          </p>
        </Section>

        <Section title="Keys and source">
          <p>
            API keys and database credentials live only in the Operator&apos;s environment file and are never
            written into the repository or shown in the interface. The whole product, including the seed
            data and every rule, is public as{" "}
            <a href={REPO} className="text-ink underline decoration-ink-muted/40 underline-offset-4 hover:text-accent-green">
              source on GitHub
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
