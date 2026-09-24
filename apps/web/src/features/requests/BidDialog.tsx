/**
 * The bid dialog on the requests board (screen 10, Stitch batch-4/requests-board, D-36; #70).
 * Pre-fills the builder's profile day rate, shows the founder's daily budget beside it, takes an
 * optional message and posts through MarketplaceApi. On 201 the parent closes it and marks the
 * card as bid. A 403 shows the engine's reason verbatim (the same sentence the board shows), a
 * 409 says closed or already bid, a 422 maps to the fields. The day rate is a positive integer
 * USD per day (D-16), checked before posting.
 *
 * Substitutions from the export: "Bidding ledger entry" and "Attested" become "Bid" and
 * "Verified"; the "attestation ledger" line and "Available for entire window" are left out
 * (availability is the engine's `available-for-brief`, shown through the path's facts).
 */
import type { Bid, BuilderProfile, Request } from "@venture-route/contracts";
import { useState, type FormEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ApiForbiddenError, ApiUnreachableError, ApiValidationError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { SKILL_LABELS } from "../../lib/brief";
import { usd } from "../../lib/format";
import { splitFieldMessages } from "../../lib/validationError";
import { FieldError } from "../builder/StatusPill";
import { helpClass, inputClass, labelClass } from "../builder/formStyles";

const BID_FIELDS: readonly string[] = ["dayRate", "message"];
const RATE_ERROR = "Enter a whole number of USD per day, at least 1.";

type Props = Readonly<{
  request: Request;
  profile: BuilderProfile | null;
  onClose(): void;
  onPlaced(bid: Bid): void;
}>;

/** Client-side check of the one rule the engine enforces on the rate (D-16). */
function parseDayRate(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function mapFailure(cause: unknown): { form?: string; fields: Record<string, string> } {
  if (cause instanceof ApiForbiddenError) return { form: cause.reason, fields: {} };
  if (cause instanceof ApiValidationError) {
    const fields: Record<string, string> = {};
    let form: string | undefined;
    for (const item of splitFieldMessages(cause.message, BID_FIELDS)) {
      if (item.field === "form") form = item.text;
      else fields[item.field] = item.text;
    }
    return { form, fields };
  }
  if (cause instanceof ApiUnreachableError && cause.message.includes("409")) {
    if (cause.message.includes("request closed")) return { form: "This request is closed.", fields: {} };
    if (cause.message.includes("already bid")) return { form: "You already bid on this request.", fields: {} };
  }
  return { form: cause instanceof Error && cause.message ? cause.message : "The bid could not be sent.", fields: {} };
}

export function BidDialog({ request, profile, onClose, onPlaced }: Props) {
  const api = useMarketplaceApi();
  const [rate, setRate] = useState(profile ? String(profile.dayRate) : "");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const skills = request.eligibility?.skills ?? [];
  const path = request.eligibility?.path ?? null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const dayRate = parseDayRate(rate);
    if (dayRate === null) {
      setErrors({ dayRate: RATE_ERROR });
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      onPlaced(await api.postBid(request.id, { dayRate, message }));
    } catch (cause) {
      const failure = mapFailure(cause);
      setErrors(failure.fields);
      setFormError(failure.form ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Bid</span>
          <DialogTitle className="font-display text-xl font-semibold text-ink">Bid on {request.title}</DialogTitle>
          <DialogDescription className="text-[13px] text-ink-muted">
            The engine found the eligible-builder rule holds for you on this brief.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-card border border-accent-green/40 bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink">
              Your eligible skills: {skills.map((skill) => SKILL_LABELS[skill]).join(", ")}
            </span>
            <span className="rounded-pill bg-accent-green px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white">
              Verified
            </span>
          </div>
          {path ? (
            <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-ink-3">
              {path.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bid-day-rate" className={labelClass}>
              Your day rate (USD)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-ink-3">USD</span>
              <input
                id="bid-day-rate"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                aria-describedby={errors.dayRate ? "error-dayRate bid-budget" : "bid-budget"}
                className={`${inputClass} w-32`}
              />
              <span className="font-mono text-sm text-ink-3">/ day</span>
            </div>
            <p id="bid-budget" className={helpClass}>
              Founder max: {usd(request.dailyBudget)}
            </p>
            <FieldError field="dayRate" errors={errors} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bid-message" className={labelClass}>
              Message to founder (optional)
            </label>
            <textarea
              id="bid-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1000}
              rows={3}
              aria-describedby={errors.message ? "error-message" : undefined}
              className={`${inputClass} h-auto py-2`}
            />
            <p className={helpClass}>Your confirmed credentials and projects are the evidence; name the one that fits.</p>
            <FieldError field="message" errors={errors} />
          </div>

          {formError ? (
            <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit bid"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
