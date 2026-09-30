/**
 * /bookings/new?builder=<slug>&request=<id> (screen 13, propose variant, Stitch
 * batch-4/interview-booking, D-36; #74): a founder proposes an interview with a confirmed
 * builder. The builder is read as a candidate for their confirmed availability; the slot picker
 * offers only what the engine's slot rules accept; "Send proposal" posts through MarketplaceApi
 * with the start as an ISO string carrying +03:00 and opens the booking on 201. A 422 renders
 * the engine's slot reason inline.
 *
 * Substitutions from the export (sprint report): the four fixed slots and the "30-min buffer",
 * "Standard consensus inquiry window", "Transmitted with signed founder credential", "Gas fee
 * waived", the 24-hour lock line and the invented cohort name.
 */
import type { Candidate } from "@venture-route/contracts";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiNotFoundError, ApiValidationError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { EMPTY_SLOT, localIso, type SlotDraft } from "../../lib/slots";
import { splitFieldMessages } from "../../lib/validationError";
import { errorMessage } from "../builder/formStyles";
import { SlotPicker } from "./SlotPicker";

const BOOKING_FIELDS: readonly string[] = ["proposedStart", "durationMin", "note", "builderId", "requestId"];

type State =
  | { kind: "loading" }
  | { kind: "loaded"; candidate: Candidate }
  | { kind: "missing" }
  | { kind: "error"; message: string };

export function BookingProposePage() {
  const [params] = useSearchParams();
  const builderId = params.get("builder") ?? "";
  const requestId = params.get("request");
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<State>({ kind: "loading" });
  // No `builder` in the query string is "missing" without a fetch, derived rather than set.
  const state: State = builderId ? loaded : { kind: "missing" };
  const [draft, setDraft] = useState<SlotDraft>(EMPTY_SLOT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!builderId) return;
    api
      .getCandidate(builderId)
      .then((candidate) => {
        if (!cancelled) setLoaded({ kind: "loaded", candidate });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoaded(
          cause instanceof ApiNotFoundError
            ? { kind: "missing" }
            : { kind: "error", message: errorMessage(cause, "This builder could not be loaded.") },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [api, builderId]);

  async function send() {
    if (!draft.day || !draft.start) {
      setFormError("Pick a day and a start time first.");
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const booking = await api.postBooking({
        builderId,
        requestId,
        proposedStart: localIso(draft.day, draft.start),
        durationMin: draft.durationMin,
        note: draft.note,
      });
      await navigate(`/bookings/${encodeURIComponent(booking.id)}`);
    } catch (cause) {
      if (cause instanceof ApiValidationError) {
        const fields: Record<string, string> = {};
        let form: string | null = null;
        for (const item of splitFieldMessages(cause.message, BOOKING_FIELDS)) {
          if (item.field === "form") form = item.text;
          else fields[item.field] = item.text;
        }
        setErrors(fields);
        // A field message renders beside its field; only an unmapped message goes to the form.
        setFormError(form ?? (Object.keys(fields).length === 0 ? cause.message : null));
      } else {
        setFormError(errorMessage(cause, "The proposal could not be sent."));
      }
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
          <span aria-hidden="true">←</span>
          <span>Back to your ventures</span>
        </Link>
      </div>

      {state.kind === "loading" ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading the builder…
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {state.message}
        </p>
      ) : null}
      {state.kind === "missing" ? (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Book an interview</h1>
          <p className="text-sm text-ink-muted">This builder has no confirmed account to book yet.</p>
          <p className="text-[13px] text-ink-3">
            Seed builders and unconfirmed profiles cannot be booked; a BASIX admin confirms accounts first.
          </p>
        </section>
      ) : null}

      {state.kind === "loaded" ? (
        <>
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold text-ink">
                Book an interview with {state.candidate.displayName}
              </h1>
              {state.candidate.demoData ? <DemoDataPill /> : null}
            </div>
            <p className="text-sm text-ink-muted">Times are shown in Africa/Nairobi.</p>
          </header>

          <SlotPicker
            availability={state.candidate.availability}
            draft={draft}
            onChange={setDraft}
            summaryLead={state.candidate.headline || undefined}
            errors={errors}
          />

          {formError ? (
            <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="rounded-md bg-accent-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send proposal"}
            </button>
            <span className="text-[12px] text-ink-3">
              The builder can accept or counter once per round; you confirm the time.
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
