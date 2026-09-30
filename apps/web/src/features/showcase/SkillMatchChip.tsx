/**
 * The matched-skill chip on a showcase card (spec #86 story 32): `GET /api/showcase?skill=`
 * returns which of a builder's skills matched and how (`MatchedSkill.kind`), and this chip only
 * ever repeats that label — a self-described match reads "Self-described", never "Verified"
 * (AGENTS.md rule 1: the kind is the engine's, never inferred or upgraded here).
 *
 * Shared piece owned by #104 (controller ruling R7): #105 imports this, it does not edit it.
 */
import type { MatchedSkill } from "@venture-route/contracts";

const KIND_LABEL: Record<MatchedSkill["kind"], string> = {
  demonstrated: "Demonstrated",
  verified: "Verified",
  "self-described": "Self-described",
};

export function SkillMatchChip({ skill }: Readonly<{ skill: MatchedSkill }>) {
  return (
    <span
      data-testid="matched-skill-chip"
      className="inline-flex h-6 items-center gap-1 rounded-pill border border-accent-green bg-accent-green/10 px-2 font-mono text-[11px] text-accent-green"
    >
      {skill.label} · {KIND_LABEL[skill.kind]}
    </span>
  );
}
