/**
 * Seam: the ecosystem constants the /ecosystem page renders equal the seed graph facts
 * (`services/engine/seed/facts.metta`), so the page can never show an entity, cohort, vertical
 * or partnership the engine does not reason over (AGENTS.md rule 10, D-34 spirit).
 */
import { describe, expect, it } from "vitest";

import { PARTNERS, UNIVERSITIES, entityName } from "../src/lib/ecosystem";
// The seed file itself, read through Vite's raw import (no Node types in the web tsconfig).
import seed from "../../../services/engine/seed/facts.metta?raw";

function facts(predicate: string): string[][] {
  const pattern = new RegExp(`^\\(${predicate} ([^)]*)\\)$`);
  return seed
    .split(/\r?\n/)
    .map((line) => pattern.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => (match[1] ?? "").split(/\s+/));
}

describe("ecosystem constants mirror the seed", () => {
  it("lists every university with its cohorts from cohort-of", () => {
    const expected = new Map<string, string[]>();
    for (const [cohort, university] of facts("cohort-of")) {
      expected.set(university ?? "", [...(expected.get(university ?? "") ?? []), cohort ?? ""]);
    }

    expect(new Map(UNIVERSITIES.map((u) => [u.id, u.cohorts]))).toEqual(expected);
  });

  it("lists every partner with its vertical and university from supports-vertical and partners-with", () => {
    const vertical = new Map(facts("supports-vertical").map(([p, v]) => [p ?? "", v ?? ""]));
    const university = new Map(facts("partners-with").map(([p, u]) => [p ?? "", u ?? ""]));
    const expected = [...vertical.keys()].map((id) => ({
      id,
      vertical: vertical.get(id),
      university: university.get(id),
    }));

    expect(PARTNERS).toEqual(expected);
  });

  it("derives display names from ids the way builder names are derived (D-24)", () => {
    expect(entityName("amani-health")).toBe("Amani Health");
    expect(entityName("omni-university")).toBe("Omni University");
    expect(entityName("cohort-2026a")).toBe("Cohort 2026a");
  });
});
