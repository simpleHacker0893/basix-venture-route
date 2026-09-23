import { useState } from "react";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { Button } from "@/components/ui/button";
import { useRouting } from "../../state/routingContext";
import { StatusBadge } from "../route/Badges";
import { handoffFileName, handoffText } from "./handoffText";

/** Screen 7 (venture-handoff export): the plain-text handoff with Copy and Download. */
function HandoffBody() {
  const { state } = useRouting();
  const [copied, setCopied] = useState(false);
  const response = state.lastResponse;
  const routed = response?.type === "route" ? response : null;

  if (!routed) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-[36px] font-medium leading-tight">Venture handoff</h1>
        <p className="text-ink-2">Route a brief first; the handoff is generated from the route the engine computed.</p>
        <div>
          <Link
            to="/route"
            className="inline-flex h-10 items-center rounded-card bg-accent-green px-5 font-medium text-white hover:bg-accent-green-hover"
          >
            Find a route
          </Link>
        </div>
      </section>
    );
  }

  const text = handoffText(routed.brief, routed.route);
  const fileName = handoffFileName(routed.brief);
  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/route" className="text-[13px] text-ink-2 underline hover:text-ink">
          Back to route
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[36px] font-medium leading-tight">Venture handoff</h1>
          <StatusBadge status={routed.route.status} />
        </div>
        <p className="text-ink-2">A plain-text summary you can share with a co-founder, mentor or BASIX operator.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <pre
          data-testid="handoff-text"
          className="overflow-x-auto whitespace-pre-wrap rounded-card border border-border bg-surface-strong p-6 font-mono text-[13px] leading-relaxed"
        >
          {text}
        </pre>
        <aside className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Export handoff</h2>
            <DemoDataPill />
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => void copy()}>
              Copy to clipboard
            </Button>
            <Button asChild variant="secondary">
              <a href={href} download={fileName}>
                Download .txt
              </a>
            </Button>
            {copied && (
              <span role="status" className="text-[13px] text-accent-green">
                Copied.
              </span>
            )}
          </div>
          <p className="text-[13px] text-ink-3">
            Generated from the structured route result only. No language model text is included.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function HandoffScreen() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <HandoffBody />
    </div>
  );
}
