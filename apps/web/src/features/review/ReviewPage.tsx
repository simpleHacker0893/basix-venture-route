import { ApiBanner } from "../../components/ApiBanner";
import { DemoDataPill } from "../../components/DemoDataPill";
import { useRouting } from "../../state/routingContext";
import { BriefEditor } from "../brief/BriefEditor";

/**
 * Screen 4 (brief-review export): every field editable, Zod re-validation before submit, a
 * server validation-error mapped to its field by the message prefix, Find my route → POST /api/route.
 */
export function ReviewPage() {
  const { state, routeBrief, setBrief, showView } = useRouting();
  const serverError = state.lastResponse?.type === "validation-error" ? state.lastResponse.message : null;

  return (
    <section className="flex flex-col gap-6">
      <ApiBanner />
      <div>
        <h1 className="font-display text-[36px] font-medium leading-tight">Confirm your brief</h1>
        <p className="text-ink-2">Edit anything that is wrong. Your latest correction wins.</p>
      </div>
      <BriefEditor
        key={JSON.stringify(state.currentBrief)}
        initial={state.currentBrief}
        busy={state.busy}
        serverError={serverError}
        onSubmit={(brief) => {
          setBrief(brief);
          void routeBrief(brief);
        }}
        onBack={() => showView("intake")}
      />
      <div className="flex items-center gap-3 text-[13px] text-ink-3">
        <DemoDataPill />
        <span>Routing uses named MeTTa rules. Nothing here is decided by a language model.</span>
      </div>
    </section>
  );
}
