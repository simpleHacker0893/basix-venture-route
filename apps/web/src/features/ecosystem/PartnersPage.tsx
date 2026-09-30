/**
 * /partners (#79): the seed ecosystem behind every route, read from `GET /api/ecosystem` (or
 * the offline snapshot). No Stitch screen exists for this page, so it uses the design tokens
 * and the context-card pattern from the route result. Every entity is fictional demo data.
 */
import type { Ecosystem } from "@venture-route/contracts";
import { useEffect, useState } from "react";

import { DemoDataPill } from "../../components/DemoDataPill";
import { VERTICAL_LABELS } from "../../lib/brief";
import { useRouting } from "../../state/routingContext";

type Load =
  | { status: "loading" }
  | { status: "ready"; ecosystem: Ecosystem }
  | { status: "error"; error: unknown };

function Card({ title, kind, children }: Readonly<{ title: string; kind: string; children: React.ReactNode }>) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] uppercase tracking-wider text-ink-3">{kind}</span>
        <DemoDataPill />
      </div>
      <h3 className="font-mono text-base font-semibold text-ink">{title}</h3>
      <div className="text-sm text-ink-2">{children}</div>
    </article>
  );
}

function Group({
  id,
  title,
  lead,
  children,
}: Readonly<{ id: string; title: string; lead: string; children: React.ReactNode }>) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 border-t border-border py-10">
      <h2 id={`${id}-heading`} className="font-display text-2xl text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{lead}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Pill({ children, mono = false }: Readonly<{ children: React.ReactNode; mono?: boolean }>) {
  return (
    <li className={`rounded-pill border border-border bg-surface-strong px-2.5 py-0.5 text-xs ${mono ? "font-mono" : ""}`}>
      {children}
    </li>
  );
}

export function PartnersPage() {
  const { source } = useRouting();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    source
      .getEcosystem()
      .then((ecosystem) => {
        if (!cancelled) setLoad({ status: "ready", ecosystem });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">Ecosystem</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-ink">Partners in the BASIX graph</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
        The organisations, universities and reusable IP that the named MeTTa rules reason over when
        they route a venture. Every record here is fictional demo data from the seed graph; no real
        partner relationship, university or IP ownership is represented.
      </p>
      {load.status === "loading" && <p className="mt-10 text-sm text-ink-muted">Loading the seed graph…</p>}
      {load.status === "error" && (
        <p role="status" className="mt-10 rounded-card border border-border bg-surface p-4 text-sm text-ink-2">
          The routing engine could not be reached, so the seed graph cannot be shown right now.
        </p>
      )}
      {load.status === "ready" && (
        <div className="mt-10">
          <Group
            id="partners"
            title="Partners"
            lead="A partner joins a route through partner-fit: the four-hop chain from the brief's vertical to a partner, a university, a cohort and a builder in that cohort."
          >
            {load.ecosystem.partners.map((partner) => (
              <Card key={partner.partnerId} kind="Partner" title={partner.partnerId}>
                <ul className="flex flex-wrap gap-2">
                  {partner.verticals.map((vertical) => (
                    <Pill key={vertical}>{VERTICAL_LABELS[vertical]}</Pill>
                  ))}
                </ul>
              </Card>
            ))}
          </Group>
          <Group
            id="universities"
            title="Universities and cohorts"
            lead="Builders belong to cohorts, and cohorts belong to universities (cohort-of). A route names the cohort and university of its selected builders."
          >
            {load.ecosystem.universities.map((university) => (
              <Card key={university.universityId} kind="University" title={university.universityId}>
                <ul className="flex flex-wrap gap-2">
                  {university.cohorts.map((cohort) => (
                    <Pill key={cohort} mono>
                      {cohort}
                    </Pill>
                  ))}
                </ul>
              </Card>
            ))}
          </Group>
          <Group
            id="reusable-ip"
            title="Reusable IP"
            lead="Licensable assets that reuse-fit can offer a brief in the same vertical when they demonstrate a required skill."
          >
            {load.ecosystem.assets.map((asset) => (
              <Card key={asset.assetId} kind="Licensable asset" title={asset.title}>
                <p>
                  <span className="font-mono text-xs text-ink-subtle">{asset.assetId}</span>
                  <span className="mx-2 opacity-50">·</span>
                  {VERTICAL_LABELS[asset.vertical]}
                </p>
              </Card>
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}
