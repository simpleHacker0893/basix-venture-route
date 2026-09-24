/**
 * /bookings/:id (screen 13, status and counter variants, Stitch batch-4/interview-booking,
 * D-36; #75): both parties follow and act on a booking. The step bar (Proposed, Accepted,
 * Confirmed) and the history come from `state` and `history`; the action row from role and
 * state, the founder-owned machine's legal cells (#58): a builder on `proposed` sees Accept and
 * Counter; a founder on `countered` sees Accept (which posts `confirm`) and Counter; a founder
 * on `accepted` sees Confirm; everyone sees nothing on `confirmed`. Counter reuses the slot
 * picker and posts the counter action. A 409 renders the machine's reason and reloads the
 * booking. There is no single-booking endpoint: the row is found in the party's own list, so a
 * non-party user sees the not-found state. Every time is the engine's Africa/Nairobi string.
 *
 * Substitutions from the export: "Join room", "Reschedule", the Google Meet line.
 */
import type { AvailabilityRange, Booking } from "@venture-route/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiUnreachableError, ApiValidationError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { bookingReadAloud } from "../../chloe/script";
import { ReadAloudButton } from "../../chloe/ui/ReadAloudButton";
import { SpeakingIndicator } from "../../chloe/ui/SpeakingIndicator";
import { useReadAloud } from "../../chloe/useReadAloud";
import { DemoDataPill } from "../../components/DemoDataPill";
import { actionsFor, type BookingAction as Action, type BookingRole as Role } from "../../lib/bookingActions";
import { formatNairobi } from "../../lib/nairobi";
import { EMPTY_SLOT, localIso, type SlotDraft } from "../../lib/slots";
import { splitFieldMessages } from "../../lib/validationError";
import { errorMessage } from "../builder/formStyles";
import { SlotPicker } from "./SlotPicker";

const STEPS: readonly { key: "proposed" | "accepted" | "confirmed"; label: string }[] = [
  { key: "proposed", label: "Proposed" },
  { key: "accepted", label: "Accepted" },
  { key: "confirmed", label: "Confirmed" },
];

const STATE_CAPTION: Record<Booking["state"], string> = {
  proposed: "Proposed · awaiting the builder",
  countered: "Countered · awaiting the founder",
  accepted: "Accepted · awaiting the founder's confirmation",
  confirmed: "Confirmed",
};

const ACTOR_LABEL = { founder: "Founder", builder: "Builder" } as const;
const ACTION_PAST = { propose: "proposed", accept: "accepted", counter: "countered", confirm: "confirmed" } as const;

function currentStep(state: Booking["state"]): "proposed" | "accepted" | "confirmed" {
  return state === "countered" ? "proposed" : state;
}

export function BookingStatusPage() {
  const { bookingId = "" } = useParams();
  const api = useMarketplaceApi();
  const auth = useAuthState();
  const role: Role = auth.role === "builder" ? "builder" : "founder";
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countering, setCountering] = useState(false);
  const [availability, setAvailability] = useState<readonly AvailabilityRange[] | null>(null);
  const [draft, setDraft] = useState<SlotDraft>(EMPTY_SLOT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Founders only (#102): Chloe reads the state and the latest proposal from this row. She only
  // speaks; every action on this screen stays a button.
  const readAloud = useReadAloud(
    useMemo(() => (booking ? [bookingReadAloud(booking)] : null), [booking]),
    auth.role === "founder",
  );

  const reload = useCallback(async () => {
    try {
      const rows = await api.listMyBookings();
      setBooking(rows.find((row) => row.id === bookingId) ?? null);
    } catch (cause) {
      setLoadError(errorMessage(cause, "The booking could not be loaded."));
    }
  }, [api, bookingId]);

  useEffect(() => {
    let cancelled = false;
    api
      .listMyBookings()
      .then((rows) => {
        if (!cancelled) setBooking(rows.find((row) => row.id === bookingId) ?? null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "The booking could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [api, bookingId]);

  async function act(action: Action, proposal?: SlotDraft) {
    setBusy(true);
    setActionError(null);
    setFieldErrors({});
    try {
      let next: Booking;
      if (action === "accept") next = await api.acceptBooking(bookingId);
      else if (action === "confirm") next = await api.confirmBooking(bookingId);
      else {
        if (!proposal?.day || !proposal.start) {
          setActionError("Pick a day and a start time first.");
          return;
        }
        next = await api.counterBooking(bookingId, {
          proposedStart: localIso(proposal.day, proposal.start),
          durationMin: proposal.durationMin,
          note: proposal.note,
        });
      }
      setBooking(next);
      setCountering(false);
      setDraft(EMPTY_SLOT);
    } catch (cause) {
      if (cause instanceof ApiValidationError) {
        const fields: Record<string, string> = {};
        for (const item of splitFieldMessages(cause.message, ["proposedStart", "durationMin", "note"])) {
          if (item.field !== "form") fields[item.field] = item.text;
        }
        setFieldErrors(fields);
        if (Object.keys(fields).length === 0) setActionError(cause.message);
      } else if (cause instanceof ApiUnreachableError && cause.message.includes("409")) {
        // The machine refused: show its reason and read the row again, since the other party
        // may have moved it.
        setActionError(cause.message.replace(/^The routing engine answered 409\.\s*/, ""));
        await reload();
      } else {
        setActionError(errorMessage(cause, "The action could not be sent."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function openCounter() {
    setCountering(true);
    setActionError(null);
    if (availability !== null || booking === null || booking === undefined) return;
    try {
      const ranges =
        role === "founder"
          ? (await api.getCandidate(booking.builderId)).availability
          : (await api.getProfile()).availability;
      setAvailability(ranges);
    } catch (cause) {
      setActionError(errorMessage(cause, "The availability could not be loaded."));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div>
        <Link
          to={role === "founder" ? "/dashboard" : "/requests"}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          <span>{role === "founder" ? "Back to your ventures" : "Back to open requests"}</span>
        </Link>
      </div>

      {booking === undefined && loadError === null ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading the booking…
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}
      {booking === null ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Booking not found</h1>
          <p className="text-sm text-ink-muted">This booking is not yours to see.</p>
        </section>
      ) : null}

      {booking ? (
        <>
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold text-ink">Interview with {booking.displayName}</h1>
              {booking.demoData ? <DemoDataPill /> : null}
            </div>
            {booking.requestTitle ? <p className="text-sm text-ink-muted">For {booking.requestTitle}</p> : null}
            <p className="font-mono text-sm text-ink">
              {formatNairobi(booking.proposedStartLocal)} · {booking.durationMin} min
            </p>
            <p className="text-[13px] text-ink-muted">{STATE_CAPTION[booking.state]}</p>
            {booking.note ? <p className="text-[13px] text-ink-2">“{booking.note}”</p> : null}
            <div>
              <ReadAloudButton readAloud={readAloud} />
            </div>
            <SpeakingIndicator />
          </header>

          <section aria-labelledby="lifecycle-heading" className="flex flex-col gap-3">
            <h2 id="lifecycle-heading" className="font-display text-xl font-semibold text-ink">
              Status &amp; lifecycle
            </h2>
            <ol aria-label="Steps" className="flex flex-wrap gap-2">
              {STEPS.map((step, index) => {
                const current = currentStep(booking.state) === step.key;
                const reached = STEPS.findIndex((s) => s.key === currentStep(booking.state)) >= index;
                return (
                  <li
                    key={step.key}
                    aria-current={current ? "step" : undefined}
                    className={`rounded-pill border px-3 py-1 text-[13px] ${
                      current
                        ? "border-accent-green bg-accent-green text-white"
                        : reached
                          ? "border-accent-green text-accent-green"
                          : "border-border-strong text-ink-3"
                    }`}
                  >
                    {index + 1}. {step.label}
                  </li>
                );
              })}
            </ol>
            <ul aria-label="History" className="flex flex-col gap-2">
              {booking.history.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-4 py-3 text-[13px]">
                  <span className="font-medium text-ink">
                    {ACTOR_LABEL[entry.actor]} {ACTION_PAST[entry.action]}
                  </span>
                  <span className="font-mono text-[12px] text-ink-muted">
                    {formatNairobi(entry.proposedStartLocal)} · {entry.durationMin} min
                  </span>
                  {entry.note ? <span className="text-ink-2">“{entry.note}”</span> : null}
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-ink-3">Times are shown in Africa/Nairobi (UTC+3).</p>
          </section>

          {actionError ? (
            <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
              {actionError}
            </p>
          ) : null}

          {actionsFor(role, booking.state).length > 0 ? (
            <div role="group" aria-label="Actions" className="flex flex-wrap gap-2">
              {actionsFor(role, booking.state).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={busy}
                  onClick={() => (item.action === "counter" ? void openCounter() : void act(item.action))}
                  className={
                    item.action === "counter"
                      ? "rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-black/5 disabled:opacity-60"
                      : "rounded-md bg-accent-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover disabled:opacity-60"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">
              {booking.state === "confirmed" ? "The interview is confirmed." : "Waiting for the other side."}
            </p>
          )}

          {countering ? (
            <section aria-labelledby="counter-heading" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
              <h2 id="counter-heading" className="font-display text-xl font-semibold text-ink">
                Counter with another time
              </h2>
              {availability === null ? (
                <p aria-live="polite" className="text-sm text-ink-muted">
                  Loading the builder&apos;s availability…
                </p>
              ) : (
                <SlotPicker availability={availability} draft={draft} onChange={setDraft} errors={fieldErrors} />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || availability === null}
                  onClick={() => void act("counter", draft)}
                  className="rounded-md bg-accent-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover disabled:opacity-60"
                >
                  Send counter
                </button>
                <button
                  type="button"
                  onClick={() => setCountering(false)}
                  className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
