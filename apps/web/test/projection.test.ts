/**
 * Seam: pure-function table test (D-19). `mettaString` must port
 * `app/engine/projection.py::metta_string` exactly (fix round 1, #106 review): the same escape
 * table, the same `\u{hex}` form for every Unicode Cc/Cf/Zl/Zp character, and the same U+FFFD
 * replacement for NUL and a lone surrogate, so the admin preview can never diverge from the fact
 * the engine actually projects.
 */
import { describe, expect, it } from "vitest";

import { credentialPreview, mettaString } from "../src/lib/projection";

describe("mettaString", () => {
  it.each([
    ['a "quoted" word', 'a \\"quoted\\" word', "double quote"],
    ["back\\slash", "back\\\\slash", "backslash"],
    ["line\nbreak", "line\\nbreak", "newline"],
    ["a\ttab", "a\\ttab", "tab"],
    ["a\rreturn", "a\\rreturn", "carriage return"],
    ["line separator", "line\\u{2028}separator", "U+2028 line separator (Zl)"],
    ["para separator", "para\\u{2029}separator", "U+2029 paragraph separator (Zp)"],
    ["bidi‮override", "bidi\\u{202e}override", "U+202E right-to-left override (Cf)"],
    ["nul\u0000byte", `nul${"�"}byte`, "NUL replaced with U+FFFD"],
    ["lone\ud800surrogate", `lone${"�"}surrogate`, "lone surrogate replaced with U+FFFD"],
    ["plain text", "plain text", "no escaping needed"],
  ])("escapes %j to %j (%s)", (input, expected) => {
    expect(mettaString(input)).toBe(`"${expected}"`);
  });
});

describe("credentialPreview issuer escaping", () => {
  it("quotes an issuer with a double quote through the same mettaString rules", () => {
    const preview = credentialPreview({
      id: "6c2d3e4f-bbbb-4ccc-9ddd-eeeeffff0000",
      builderId: "kofi-mensah",
      displayName: "Kofi Mensah",
      title: "AWS Cloud Practitioner",
      issuer: 'Amazon "AWS" Web Services',
      skillId: null,
      issuedOn: null,
      credentialUrl: null,
      submittedAt: "2026-09-21T10:05:00+03:00",
      demoData: true,
    });
    expect(preview.facts).toEqual([
      '(certified kofi-mensah cred-6c2d3e4f "Amazon \\"AWS\\" Web Services")',
    ]);
  });
});
