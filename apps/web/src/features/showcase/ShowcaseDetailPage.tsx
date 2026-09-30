/**
 * /showcase/:projectId (spec #86 stories 39-46, prompt 6.2): a public project page, no
 * sign-in needed. `MarketplaceApi.showcase.get` decides everything shown — status, skills,
 * evidence and links; this screen only renders what the engine's projection said. A hidden or
 * missing entry answers 404 ("This project isn't on the Showcase."); no contact detail is ever
 * rendered here (D-43).
 */
import type { ShowcaseDetail } from "@venture-route/contracts";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiNotFoundError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { isoDate } from "../../lib/format";
import { BuilderPanel } from "./BuilderPanel";
import { PitchVideo } from "./PitchVideo";

const EXTERNAL_REL = "noopener noreferrer";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; detail: ShowcaseDetail }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export function ShowcaseDetailPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const api = useMarketplaceApi();
  // Keyed by projectId so a navigation between projects derives "loading" instead of a stale render.
  const [result, setResult] = useState<{ projectId: string; state: State } | null>(null);
  const state: State = result !== null && result.projectId === projectId ? result.state : { kind: "loading" };

  useEffect(() => {
    let cancelled = false;
    api.showcase
      .get(projectId)
      .then((detail) => {
        if (!cancelled) setResult({ projectId, state: { kind: "loaded", detail } });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        void cause;
        const next: State =
          cause instanceof ApiNotFoundError ? { kind: "not-found" } : { kind: "error", message: "This project could not be loaded." };
        setResult({ projectId, state: next });
      });
    return () => {
      cancelled = true;
    };
  }, [api, projectId]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      {state.kind !== "not-found" ? (
        <div>
          <Link to="/showcase" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
            <span aria-hidden="true">←</span>
            <span>Back to Showcase</span>
          </Link>
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading project…
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {state.message}
        </p>
      ) : null}

      {state.kind === "not-found" ? <NotFoundState /> : null}

      {state.kind === "loaded" ? <DetailView detail={state.detail} /> : null}
    </div>
  );
}

function NotFoundState() {
  return (
    <section aria-label="Not found" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
      <h1 className="font-display text-2xl font-semibold text-ink">This project isn&apos;t on the Showcase.</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
        It may have been hidden by its builder, or it never existed.
      </p>
      <Link to="/showcase" className="self-start text-[13px] text-accent-green underline hover:text-accent-green-hover">
        Back to Showcase
      </Link>
    </section>
  );
}

function DetailView({ detail }: Readonly<{ detail: ShowcaseDetail }>) {
  const links: Array<{ label: string; url: string }> = [
    detail.liveUrl ? { label: "Live app", url: detail.liveUrl } : null,
    detail.demoUrl ? { label: "Demo", url: detail.demoUrl } : null,
    detail.pitchDeckUrl ? { label: "Pitch deck", url: detail.pitchDeckUrl } : null,
  ].filter((link): link is { label: string; url: string } => link !== null);

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl leading-tight text-ink">{detail.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-ink-muted">
            {VERTICAL_LABELS[detail.vertical]} · Completed {isoDate(detail.completedOn)}
          </p>
          {detail.licensable ? (
            <span className="inline-flex h-6 items-center rounded-pill border border-project px-2.5 text-[12px] font-medium text-project">
              Licensable
            </span>
          ) : null}
          {detail.demoData ? <DemoDataPill /> : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <PitchVideo pitchVideoId={detail.pitchVideoId} />

          {links.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel={EXTERNAL_REL}
                    className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface-strong px-3 text-sm font-medium text-ink hover:border-accent-green"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <p className="text-[13px] text-ink-3">Opens in a new tab</p>
            </div>
          ) : null}

          <section aria-label="About this project" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
            <h2 className="font-display text-xl font-semibold text-ink">About this project</h2>
            <p className="text-sm leading-relaxed text-ink-muted">{detail.description}</p>
          </section>

          <section aria-label="Demonstrated skills" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Demonstrated skills</h2>
            <div className="flex flex-wrap gap-1.5">
              {detail.skillIds.map((skillId) => (
                <span key={skillId} className="rounded-pill border border-border-strong bg-surface-strong px-2.5 py-1 text-[13px]">
                  {SKILL_LABELS[skillId]}
                </span>
              ))}
            </div>
          </section>
        </div>

        <BuilderPanel builder={detail.builder} />
      </div>
    </>
  );
}
