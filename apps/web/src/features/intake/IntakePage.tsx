import { VentureBrief } from "@venture-route/contracts";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { ApiBanner } from "../../components/ApiBanner";
import { toBriefInput } from "../../lib/brief";
import { useRouting } from "../../state/routingContext";
import { BriefEditor } from "../brief/BriefEditor";
import { BriefPanel } from "./BriefPanel";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { ScenarioChips } from "./ScenarioChips";

/** Screen 3: chat thread, scenario chips and the composer, with "Your brief so far" beside them. */
export function IntakePage() {
  const { state, loadScenarios, sendTurn, routeBrief, showView } = useRouting();
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "form" ? "form" : "chat";
  const serverError = state.lastResponse?.type === "validation-error" ? state.lastResponse.message : null;

  useEffect(() => {
    if (state.scenarios.length === 0) void loadScenarios();
    // Load once per mount; the store keeps the list afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A complete brief is confirmed deterministically through POST /api/route (form path). */
  function confirmBrief() {
    const input = state.currentBrief ? toBriefInput(state.currentBrief) : null;
    const parsed = input ? VentureBrief.safeParse(input) : null;
    if (parsed?.success) void routeBrief(parsed.data);
    else showView("review");
  }

  return (
    <section className="flex flex-col gap-8">
      <ApiBanner />
      <div className="grid grid-cols-12 items-start gap-6">
        <div className="col-span-12 flex flex-col gap-8 lg:col-span-8">
          <div className="border-b border-border pb-6">
            <h1 className="font-display text-[36px] font-medium leading-tight">Describe your MVP</h1>
            <p className="text-ink-2">Plain language is fine. We will ask for anything missing.</p>
          </div>
          {mode === "form" ? (
            <BriefEditor
              key={JSON.stringify(state.currentBrief)}
              initial={state.currentBrief}
              busy={state.busy}
              serverError={serverError}
              onSubmit={(brief) => {
                setParams({});
                void routeBrief(brief);
              }}
              onBack={() => setParams({})}
            />
          ) : (
            <>
              <ChatThread turns={state.turns} />
              {state.busy && (
                <p role="status" className="text-[13px] text-ink-3">
                  Assistant is thinking…
                </p>
              )}
              {serverError && (
                <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-4 py-3 text-[13px] text-danger">
                  {serverError}
                </p>
              )}
              <div className="flex flex-col gap-4">
                <ScenarioChips />
                <Composer
                  busy={state.busy}
                  onSend={(text) =>
                    void sendTurn({ userMessage: text, currentBrief: state.currentBrief ?? null })
                  }
                  onUseForm={() => setParams({ mode: "form" })}
                />
              </div>
            </>
          )}
        </div>
        <div className="col-span-12 lg:col-span-4">
          <BriefPanel brief={state.currentBrief} onFindRoute={confirmBrief} />
        </div>
      </div>
    </section>
  );
}
