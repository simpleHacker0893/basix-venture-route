/**
 * Unit tests for Chloe's yes/no phrase matcher (D-19, #116).
 */
import { describe, expect, it } from "vitest";
import { matchConfirm, normalise } from "../src/chloe/confirm";

describe("normalise", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalise("YES!")).toBe("yes");
    expect(normalise("Go  Ahead?")).toBe("go ahead");
    expect(normalise("  Do   IT  ")).toBe("do it");
  });
});

describe("matchConfirm", () => {
  describe("existing YES phrases", () => {
    it("matches 'yes'", () => {
      expect(matchConfirm("yes")).toBe("yes");
    });

    it("matches 'go ahead'", () => {
      expect(matchConfirm("go ahead")).toBe("yes");
    });

    it("matches 'do it'", () => {
      expect(matchConfirm("do it")).toBe("yes");
    });

    it("matches phrases starting with yes phrases", () => {
      expect(matchConfirm("yes please")).toBe("yes");
      expect(matchConfirm("go ahead then")).toBe("yes");
      expect(matchConfirm("do it now")).toBe("yes");
    });
  });

  describe("new YES phrases (Q-14)", () => {
    it("matches 'yeah'", () => {
      expect(matchConfirm("yeah")).toBe("yes");
    });

    it("matches 'yep'", () => {
      expect(matchConfirm("yep")).toBe("yes");
    });

    it("matches 'sure'", () => {
      expect(matchConfirm("sure")).toBe("yes");
    });

    it("matches 'yeah' with trailing words", () => {
      expect(matchConfirm("yeah go ahead")).toBe("yes");
    });

    it("matches 'yep' with trailing words", () => {
      expect(matchConfirm("yep sure")).toBe("yes");
    });

    it("matches 'sure' with trailing words", () => {
      expect(matchConfirm("sure thing")).toBe("yes");
    });
  });

  describe("existing NO phrases", () => {
    it("matches 'no'", () => {
      expect(matchConfirm("no")).toBe("no");
    });

    it("matches 'wait'", () => {
      expect(matchConfirm("wait")).toBe("no");
    });

    it("matches 'not yet'", () => {
      expect(matchConfirm("not yet")).toBe("no");
    });

    it("matches phrases starting with no phrases", () => {
      expect(matchConfirm("no way")).toBe("no");
      expect(matchConfirm("wait a moment")).toBe("no");
      expect(matchConfirm("not yet done")).toBe("no");
    });
  });

  describe("new NO phrase (Q-14)", () => {
    it("matches 'nope'", () => {
      expect(matchConfirm("nope")).toBe("no");
    });

    it("matches 'nope' with trailing words", () => {
      expect(matchConfirm("nope not now")).toBe("no");
    });
  });

  describe("non-matching words", () => {
    it("does not match 'now' (not a phrase start)", () => {
      expect(matchConfirm("now")).toBeNull();
    });

    it("does not match longer words that start with phrases", () => {
      expect(matchConfirm("surely")).toBeNull();
      expect(matchConfirm("yepper")).toBeNull();
      expect(matchConfirm("nopes")).toBeNull();
    });

    it("returns null for unrelated text", () => {
      expect(matchConfirm("maybe")).toBeNull();
      expect(matchConfirm("i don't know")).toBeNull();
      expect(matchConfirm("")).toBeNull();
    });
  });
});
