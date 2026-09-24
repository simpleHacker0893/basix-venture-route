/**
 * "Suggest from résumé" (Stitch batch-3/builder-profile, spec #86 stories 20-26, D-50): pasted
 * résumé text goes to `POST /api/me/skills/suggest`, never stored or logged; suggestions arrive
 * as chips the builder accepts or dismisses one at a time. An accepted chip is handed to the
 * caller (`onAccept`), which saves it to `suggestedSkills`, never `skillSet` — this component
 * never decides eligibility or picks entities (AGENTS.md non-negotiable 4). `onAccept` reports
 * back whether the chip was actually added: the caller (`ProfileForm`) enforces the same
 * combined-list, case-insensitive, 20-entry rule the engine enforces (`schemas.py`), so a
 * rejected accept keeps its chip on screen with the reason, instead of silently vanishing.
 * When the endpoint answers `available:false` the button stays named "Suggest skills" (an
 * accessible name never changes to prose) but is disabled, with the exact required copy shown as
 * visible text and wired through `aria-describedby` so assistive tech reads why.
 */
import { SkillSuggestRequest, type SkillSuggestion } from "@venture-route/contracts";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { errorMessage, helpClass, labelClass } from "./formStyles";

const UNAVAILABLE_LABEL = "Suggestions need the assistant; add skills by hand.";
const CAPTION_ID = "resume-suggestions-caption";
const UNAVAILABLE_ID = "resume-suggestions-unavailable";

type ResumeSuggestionsProps = Readonly<{
  /** `true` when the label was actually added; `false` leaves the chip on screen. */
  onAccept(label: string): boolean;
  /** `skillSet` + `suggestedSkills` combined, so a rejected accept can say why (duplicate or cap). */
  currentSkills: readonly string[];
  max?: number;
}>;

export function ResumeSuggestions({ onAccept, currentSkills, max = 20 }: ResumeSuggestionsProps) {
  const api = useMarketplaceApi();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    const parsed = SkillSuggestRequest.safeParse({ resumeText: text });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Paste at least 50 characters of résumé text.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await api.suggestSkills(parsed.data.resumeText);
      if (!result.available) {
        setUnavailable(true);
        setSuggestions([]);
      } else {
        setSuggestions(result.suggestions);
      }
    } catch (cause) {
      setError(errorMessage(cause, "Suggestions could not be fetched."));
    } finally {
      setBusy(false);
    }
  }

  function accept(label: string) {
    const exists = currentSkills.some((skill) => skill.toLowerCase() === label.toLowerCase());
    const reason = exists ? "Already in your skill set" : currentSkills.length >= max ? "20-skill limit reached" : null;
    const added = onAccept(label);
    if (added) {
      setSuggestions((current) => current.filter((s) => s.label !== label));
      setReasons((current) => {
        const next = { ...current };
        delete next[label];
        return next;
      });
    } else {
      setReasons((current) => ({ ...current, [label]: reason ?? "Could not be added." }));
    }
  }

  function dismiss(label: string) {
    setSuggestions((current) => current.filter((s) => s.label !== label));
    setReasons((current) => {
      const next = { ...current };
      delete next[label];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <label htmlFor="resume-suggestions-text" className={labelClass}>
        Suggest from résumé
      </label>
      <textarea
        id="resume-suggestions-text"
        rows={4}
        value={text}
        aria-describedby={CAPTION_ID}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        className="rounded-card border border-border-strong bg-surface-strong px-3 py-2 text-sm focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
      <span id={CAPTION_ID} className={helpClass}>
        Your text is sent to Anthropic's Claude to suggest skills and is not stored.
      </span>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={busy || unavailable}
        aria-busy={busy}
        aria-describedby={unavailable ? UNAVAILABLE_ID : undefined}
        onClick={() => void suggest()}
      >
        {busy ? "Suggesting…" : "Suggest skills"}
      </Button>
      {unavailable ? (
        <p id={UNAVAILABLE_ID} role="status" className="text-[13px] text-ink-2">
          {UNAVAILABLE_LABEL}
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul aria-label="Résumé suggestions" className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.label}
              className="inline-flex h-8 flex-wrap items-center gap-2 rounded-pill border border-border-strong bg-surface-strong px-3 text-sm"
            >
              <span>{suggestion.label}</span>
              <button type="button" onClick={() => accept(suggestion.label)} className="text-accent-green underline">
                {`Accept ${suggestion.label}`}
              </button>
              <button type="button" onClick={() => dismiss(suggestion.label)} className="text-ink-3 underline">
                {`Dismiss ${suggestion.label}`}
              </button>
              {reasons[suggestion.label] ? (
                <span role="alert" className="text-[12px] text-danger">
                  {reasons[suggestion.label]}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
