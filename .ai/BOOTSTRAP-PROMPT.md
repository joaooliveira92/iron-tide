# Greenfield Bootstrap Prompt

> **Superseded (2026-10-10).** The bootstrap phase is complete; the living workflow is
> `AGENTS.md` + `.ai/ORCHESTRATION.md` and the backlog in `.ai/SPRINT-PLAN.md`. Kept for
> historical reference only.

Execute the approved bootstrap brief under `.ai/ENGINEERING-CONTRACT.md` and `.ai/AUTONOMOUS-AGENT.md`.

## Objective

Create the smallest production-quality foundation that proves strict package boundaries, deterministic primitives, structured diagnostics, safe YAML compilation, canonical serialization, and artifact hashing. Stop before campaign compilation or strategic simulation.

## Required behavior

- Inspect the actual environment first.
- Initialize a pnpm-workspace/Turborepo repository only if not already initialized.
- Use strict TypeScript and declared package exports.
- Pin runtime and package-manager policy.
- Establish formatting, linting, type checking, tests, builds, dependency-boundary checks, secret scanning, and CI entry points.
- Create the initial ADRs and requirement index.
- Implement minimal connected content schemas and a manifest-driven content compiler.
- Reject unknown fields, duplicate IDs, unsafe YAML, undeclared authoritative files, missing references, invalid semantic combinations, unsafe paths, excessive size, and excessive nesting through stable diagnostics.
- Implement deterministic safe-integer primitives, explicit rounding, canonical serialization, and SHA-256 envelopes.
- Create valid and invalid fixtures.
- Add human-readable and JSON diagnostics to the CLI.
- Ensure failure leaves no partial final artifact.
- Add cancellation with `AbortSignal` at orchestration and I/O boundaries.
- Produce validation evidence and an adversarial self-review.

## Explicitly out of scope

- campaign compilation;
- monthly simulation;
- AI;
- tactical simulation;
- battle auto-resolution;
- save-game persistence;
- Electron UI beyond an optional nonfunctional placeholder;
- broad production content;
- dynamic compiler plugins;
- arbitrary formula execution;
- mod scripting.

## Completion rule

Do not claim completion until all acceptance criteria in the concrete brief pass and a secondary consistency check confirms artifact hashes, diagnostic ordering, no partial outputs, package graph direction, and clean Git state.
