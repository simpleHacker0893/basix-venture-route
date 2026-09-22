---
status: accepted
decision: D-06
date: 2026-09-22
---

# Anthropic SDK behind an LlmAdapter interface

## Context

The LLM only translates briefs and explains routes (PRD §5.7). The Operator holds an Anthropic key, and the product must keep working with no key at all.

## Decision

The LLM is Anthropic's `anthropic` Python SDK, model `claude-opus-5`, with structured output via `output_config.format` and a server-side key. Orchestration calls an `LlmAdapter` interface so a second provider can be added without touching it. The form fallback ships in Sprint 001. (`planning/DECISIONS.md` D-06)

## Consequences

With `ANTHROPIC_API_KEY` unset a null adapter serves every response type, so tests and the demo floor never depend on the network. The adapter receives only the structured `VentureRoute`, never raw graph data.
