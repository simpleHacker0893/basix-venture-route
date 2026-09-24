/**
 * The booking action row per role and state (Sprint 004, #75): the founder-owned machine's
 * legal cells (spec #52 §Booking state machine), labelled for the screen. The founder's
 * "Accept" on a counter is the `confirm` action; the API exposes accept, counter and confirm
 * only, and it, not this table, decides what is legal.
 */
import type { Booking } from "@venture-route/contracts";

export type BookingAction = "accept" | "counter" | "confirm";
export type BookingRole = "founder" | "builder";
export type BookingButton = { label: string; action: BookingAction };

export function actionsFor(role: BookingRole, state: Booking["state"]): BookingButton[] {
  if (role === "builder" && state === "proposed") {
    return [
      { label: "Accept", action: "accept" },
      { label: "Counter", action: "counter" },
    ];
  }
  if (role === "founder" && state === "countered") {
    return [
      { label: "Accept", action: "confirm" },
      { label: "Counter", action: "counter" },
    ];
  }
  if (role === "founder" && state === "accepted") return [{ label: "Confirm", action: "confirm" }];
  return [];
}
