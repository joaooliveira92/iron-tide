# Bluewave Engine and Compiler Prompt Suite

> **Superseded (2026-10-10).** This pre-`AGENTS.md` prompt suite described the original
> bootstrap workflow. The living workflow is `AGENTS.md` + `.ai/ORCHESTRATION.md`
> (with `.ai/ENGINEERING-CONTRACT.md` and `.ai/SPRINT-PLAN.md`). Kept for historical
> reference only.

This suite governs autonomous development of the Bluewave TypeScript engine and compiler.

## Canonical inputs

The repository must contain:

- `README.md`, the binding canonical game-design baseline.
- This `.ai/` prompt suite.
- Approved ADRs and design amendments created during implementation.

Do not copy the entire canonical design into coding prompts. Reference it through stable requirement IDs in `.ai/REQUIREMENTS.md`.

## Precedence

1. Safety, legal, credential, and destructive-operation constraints
2. Canonical game design and approved amendments
3. `.ai/ENGINEERING-CONTRACT.md`
4. Approved ADRs and compatibility contracts
5. Current milestone brief
6. Reusable implementation prompt
7. Local conventions and agent judgment

If two applicable instructions conflict, stop and create a decision request. Never resolve a gameplay conflict silently.

## Recommended use

1. Give the agent `.ai/AUTONOMOUS-AGENT.md` as its standing operating prompt.
2. For a greenfield repository, run `.ai/BOOTSTRAP-PROMPT.md`.
3. For subsequent work, combine `.ai/IMPLEMENTATION-PROMPT.md` with one approved milestone brief.
4. Before acceptance, run `.ai/REVIEW-PROMPT.md` in a fresh review context.
5. Use `.ai/RELEASE-PROMPT.md` at release or compatibility gates.

## Roadmap

The authoritative, living backlog is `.ai/SPRINT-PLAN.md`, executed through the
orchestrator + subagent workflow described in `AGENTS.md` and
`.ai/ORCHESTRATION.md`. Current state (verified, not doc-only):

- B0–B8: done — governance, primitives, content compiler, reduced-fixture campaign
  compiler, commands/phases, one-month slice, persistence/replay, battle
  auto-resolution, cross-process determinism.
- B9: done — Electron shell, packaged smoke test.
- B10a–d: done — economy & construction, research & ship design, diplomacy & war,
  AI & scenario readiness.
- M1 `M1_STRATEGIC_CAMPAIGN_KERNEL`: ACCEPTED.
- CONTENT track: CONTENT-0..3 done (production pack `content/production/1880/`, PRE_WAR
  and INTERWAR tech/design slices).
- M2 Track B: B-1..B-5 done (tactical scaffolding, movement/spotting, gunnery, armor &
  damage, weather & visibility); B-6 (battle results → campaign integration) next.
- M2–M5: no briefs yet — Track B remainder (M2 acceptance), Track C (M3), Track D
  (M4), Track E (M5), and REL-1 (full release validation) each open with a scoping
  sprint.

Initial history: the bootstrap brief combined the smallest coherent portions of B0
through B2 and stopped before campaign compilation.
