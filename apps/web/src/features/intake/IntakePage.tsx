import { useEffect, useState } from "react";

import { ApiBanner } from "../../components/ApiBanner";
import { useRouting } from "../../state/routingContext";
import { BriefEditor } from "../brief/BriefEditor";
import { BriefPanel } from "./BriefPanel";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { ScenarioChips } from "./ScenarioChips";

type IntakePageProps = Readonly<{ initialMode?: "chat" | "form" }>;

/** Screen 3: chat thread, scenario chips and the composer, with "Your brief so far" beside them. */
export function IntakePage({ initialMode = "chat" }: IntakePageProps) {
  const { state, loadScenarios, sendTurn, routeBrief } = useRouting();
  const [mode, setMode] = useState<"chat" | "form">(initialMode);

  useEffect(() => {
    if (state.scenarios.length === 0) void loadScenarios();
    // Load once per mount; the store keeps the list afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              busy={state.busy}
              onSubmit={(brief) => void routeBrief(brief)}
              onBack={() => setMode("chat")}
            />
          ) : (
            <>
              <ChatThread turns={state.turns} />
              <div className="flex flex-col gap-4">
                <ScenarioChips />
                <Composer
                  busy={state.busy}
                  onSend={(text) =>
                    void sendTurn({ userMessage: text, currentBrief: state.currentBrief ?? null })
                  }
                  onUseForm={() => setMode("form")}
                />
              </div>
            </>
          )}
        </div>
        <div className="col-span-12 lg:col-span-4">
          {/* Chat path: a complete brief is confirmed through POST /api/conversation. */}
          <BriefPanel
            brief={state.currentBrief}
            onFindRoute={() => void sendTurn({ userMessage: "", currentBrief: state.currentBrief ?? null })}
          />
        </div>
      </div>
    </section>
  );
}
