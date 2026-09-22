# AUTOMATION — how sprints run without a human typing every prompt

## Principle
One Builder session per sprint, one branch, one PR. Humans gate merges. Timeline slots start sessions; acceptance decides whether a sprint is done. A missed gate never auto-starts the next sprint on top of broken work: every Builder prompt begins with a merge check and stops if the previous sprint is not merged.

## Two Builder paths (D-12)
| Path | How it starts | When to use |
|---|---|---|
| Cloud | A Claude Code Remote **Routine** fires at the slot's start time (TIMELINE.md) and spawns a fresh session with the sprint's `handoff-prompt.md` | Default once the Claude GitHub App is installed |
| Local | Operator runs `claude` in the repo and pastes `handoff-prompt.md` | Fallback, or any sprint the Operator wants to watch |

Both paths run the same prompt and produce the same PR, so the review is identical.

## Routines to arm (Architect creates them once GitHub access works)
| Name | Fires (UTC = EAT−3) | Prompt |
|---|---|---|
| `vr-sprint-000` | 2026-09-22 15:00Z | `planning/sprints/000-metta-spike/handoff-prompt.md` |
| `vr-sprint-001` | 2026-09-23 09:00Z | `planning/sprints/001-routing-core/handoff-prompt.md` |
| `vr-sprint-002` | 2026-09-25 05:00Z | `planning/sprints/002-founder-ui/handoff-prompt.md` |
| `vr-sprint-003` | 2026-09-27 05:00Z | `planning/sprints/003-marketplace/handoff-prompt.md` |
| `vr-sprint-004` | 2026-09-29 05:00Z | `planning/sprints/004-requests-interviews/handoff-prompt.md` |
| `vr-sprint-005` | 2026-09-30 05:00Z | `planning/sprints/005-demo-hardening/handoff-prompt.md` |
| `vr-gate-check` | daily 17:00Z (20:00 EAT), 22–30 Sep | Architect Builder Review of the open sprint PR against `acceptance.md`; post findings as a PR review; update `STATE.md` if merged |

Each Routine creates a fresh session (`create_new_session_on_fire`) with `source_url` = this repo, `source_revision` = `master`, and `outcome_branch` = `sprint/<NNN>-<slug>`.

## Merge check (first lines of every handoff prompt)
```
Before any work: fetch origin. If the previous sprint's PR (title "Sprint <N-1>: …") is not merged into master, post one comment on that PR saying this sprint is waiting on it, and stop. Do not start this sprint on an unmerged base.
```

## Ticket slicing (Matt Pocock `to-tickets`)
The Builder runs `to-tickets` on `requirements.md` and writes tracer-bullet tickets to `planning/sprints/<sprint>/tickets/NN-<slug>.md` (What to build / Acceptance criteria / Blocked by). Tickets are committed in the sprint PR. Each ticket is implemented with `implement` + `tdd`; `code-review` runs on the whole branch before the PR leaves draft.

## Subagents (`.claude/agents/`)
- `sprint-builder`: implements one ticket at a time with TDD; may not spawn subagents; reports RED/GREEN evidence.
- `sprint-reviewer`: two-axis review (Standards from AGENTS.md; Spec from the sprint's requirements + acceptance); returns ✅/❌ per axis; never edits code.
The main Builder session orchestrates: for each ticket, dispatch `sprint-builder`, then `sprint-reviewer`; fix loop max 3 rounds; then whole-branch review before the PR.

## Completion report (PR body, 120x Prompt 06)
1. Sprint name and branch.
2. Acceptance checklist: every line of `acceptance.md` with ✅/❌ and the command + output that proves it.
3. What shipped (files, endpoints, screens).
4. What did not ship and why.
5. Deviations from `blueprint.md` and the reason.
6. New questions for `QUESTIONS.md`.
7. Risks discovered.
8. Proposed `STATE.md` diff (included in the PR).
A PR is marked ready only when item 2 has no ❌ in the "must" section. A ❌ in "should" is allowed with a named follow-up ticket.

## Architect Builder Review (gate check)
Re-run every acceptance command locally from the PR head. Compare with the report. Verdict: `DONE`, `DONE_WITH_FOLLOW_UPS` (should-items only), or `NOT_DONE` with the failing lines quoted. Post as a PR review. Operator merges on `DONE` or `DONE_WITH_FOLLOW_UPS`.
