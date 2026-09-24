/**
 * /privacy (#79): what the product stores and shows, stated from AGENTS.md rule 5, PRD §8 and
 * DOMAIN.md §Marketplace rules. No Stitch screen exists for this page; design tokens only.
 */
import { Link } from "react-router";

function Block({ id, title, children }: Readonly<{ id: string; title: string; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">Venture Route</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-ink">Privacy</h1>
      <div className="mt-8 space-y-8 text-base leading-relaxed text-ink-2">
        <Block id="privacy-demo" title="Everything here is fictional demo data">
          Venture Route is a hackathon proof of concept for the BASIX ecosystem on the SingularityNET
          MeTTa track. Every builder, credential, project, cohort, university, partner and asset in
          the graph is fictional demo data, and every record a person enters is stored as demo data
          too. No real availability, credential, IP ownership or partner relationship is represented,
          and the Demo data pill marks each record on screen.
        </Block>
        <Block id="privacy-account" title="Accounts">
          Sign-in is handled by Clerk, which holds your sign-in identity, your e-mail address and the
          role you choose once (founder or builder). The routing engine keeps only your Clerk id,
          e-mail, role and confirmation status. Routing a venture needs no account at all.
        </Block>
        <Block id="privacy-sharing" title="What founders can see">
          A builder profile is invisible to founders until a BASIX admin confirms the account. After
          that, founders see the profile, availability, verified skills and confirmed projects.
          Contact details reach a founder only through the three sharing toggles on the profile
          (e-mail, phone, LinkedIn); anything switched off is never sent.
        </Block>
        <Block id="privacy-model" title="The language model">
          When a model key is configured, the model receives your brief text to extract fields and
          the computed route to write a summary. It never receives the graph, never selects people
          and never sets the route status. Without a key the structured form is the only input path
          and no text leaves the engine.
        </Block>
        <p className="text-sm text-ink-muted">
          The seed graph behind every route is on the{" "}
          <Link to="/partners" className="underline underline-offset-4 hover:text-accent-green">
            Partners page
          </Link>
          ; the product requirements are linked in the footer.
        </p>
      </div>
    </div>
  );
}
