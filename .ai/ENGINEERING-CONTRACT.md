# Bluewave Engineering Contract

## Status

Mandatory. This contract applies to every code, content, build, persistence, and architecture change in the Bluewave repository.

## Canonical authority

`README.md` is binding. Assign traceable requirement IDs without rewriting its meaning. Do not silently reinterpret gameplay rules, invent missing canonical content, or weaken production validation to accommodate fixtures. When two plausible interpretations produce different authoritative outcomes, stop and create a decision request.

## Technology and repository

- Use strict TypeScript, pnpm workspaces, Vite+ (`vp`), Vite, React, and Electron.
- Pin the Node.js policy and exact pnpm version. Use a frozen lockfile in CI.
- Keep authoritative compiler and simulation execution in Node.js.
- Keep domain packages independent of Node, filesystem, database, Electron, React, IPC, localization, and renderer state.
- Enforce a directed package graph, public package exports, and no internal cross-package source imports.
- Do not introduce speculative packages or one package per entity.

## Authority and state

- Distinguish canonical, derived, cached projection, ledger, and ephemeral data.
- React and UI state are never authoritative simulation state.
- Commands never mutate authoritative state directly.
- Validate, authorize, reserve, accept or reject, lock, resolve, emit outcomes and events, then produce new aggregate versions.
- Use canonical immutable snapshots plus append-only command, event, financial, and random-decision ledgers. Do not impose unrestricted event sourcing.
- Derived values must be pure, reproducible, versioned where necessary, and explainable. A cache never competes with canonical authority.

## Determinism

Identical content, ruleset, inputs, commands, seeds, and compatibility versions must produce identical authoritative hashes across supported operating systems.

Authoritative packages must not directly read:

- `Math.random()` or random UUID APIs
- current wall-clock time
- `process.env`
- system locale or timezone
- filesystem enumeration order
- network state, hostname, process ID, or thread scheduling
- mutable global singleton state
- platform path separators as game data

All required inputs enter through validated requests or explicit ports.

Use hierarchical, domain-separated random decisions. Do not expose a generic global or subsystem `nextRandom()` service. Every random outcome records stream identity, stable entity key, phase, ruleset version, input hash, draw or derived value, outcome, and reason code.

## Arithmetic

- Authoritative outcomes use integer or fixed-point arithmetic.
- Use branded safe-integer unit types, checked arithmetic, explicit bounds, and explicit rounding.
- Reject non-integers and unsafe integers at construction boundaries.
- Introduce `bigint` only after documented bound analysis proves it necessary.
- Rendering may use floating point but may not alter authoritative state.

## Identity, serialization, and hashing

- Use stable authored string IDs for canonical content and deterministic derived IDs for compiled entities.
- No ambient random identity generation in authoritative workflows.
- Use a versioned canonical serializer. Define object-key ordering, collection ordering, Unicode normalization, integer representation, and unsupported values.
- Use SHA-256 initially with domain-separated envelopes containing artifact kind and relevant compatibility versions.
- Never treat incidental JavaScript insertion order as the canonical contract.

## Compiler design

- Use explicit, statically ordered, typed stages with immutable inputs and outputs.
- Stages return structured diagnostics, do not perform ambient I/O, do not write final artifacts, and do not obtain ambient randomness.
- Use only meaningful intermediate representations. Avoid a giant partially initialized object and avoid a type per trivial function.
- Accumulate independent errors within a safe stage, then block downstream stages whose prerequisites are invalid.
- Keep validation, normalization, and repair distinct. Repair is explicit, narrow, logged, and limited to safely recomputable or contractually generated data.

## Content

- Author normal content in YAML and compile it to canonical artifacts.
- Parse YAML without executable tags or arbitrary object construction.
- Use strict boundary schemas and reject unknown fields by default.
- Decode untrusted boundaries and serialization contracts with Effect `Schema` (Zod was replaced, ADR-0102/0105). Decode, never assert: a boundary `JSON.parse(...) as T` cast is rejected by `scripts/assert-boundary-decode.mjs` in the scopes it guards. Keep semantic rules and aggregate invariants in explicit domain code.
- Ordinary content must not execute JavaScript, TypeScript, shell, arbitrary expressions, or database scripts.
- The pack manifest explicitly declares roots, collections, dependencies, versions, localization, and fixture or production classification.
- Namespaced editor metadata cannot affect mechanics unless promoted into a versioned authoritative contract.

## Formulas and explanations

- Authored rulesets reference stable formula IDs and provide versioned constants.
- Implement formulas in a controlled TypeScript registry.
- Every authoritative formula declares ID, version, units, input bounds, rounding, and output explanation.
- Important calculations return structured explanation trees using stable semantic terms. Localized text is presentation-only.

## Persistence and compatibility

- Pin content, ruleset, formulas, RNG, AI policy, serializer, save, command, and event contract versions as applicable.
- Never continue a save with approximate or newest formulas when the pinned implementation is unavailable.
- Require an explicit migration or reject authoritative continuation with a stable diagnostic.
- Save atomically: write temporary content, validate, hash, commit, update the active pointer, and retain recoverable prior state.
- Canonical artifact changes require old and new hashes, authoritative cause, version impact, and migration assessment.

## Electron boundary

- Use explicit `main`, `preload`, and `renderer` boundaries.
- Renderer code must not import authoritative engine packages or filesystem capabilities.
- Use context isolation, disable renderer Node integration, sandbox where compatible, and expose narrow capability-specific preload methods.
- Decode IPC requests and responses at the boundary with a strict Effect `Schema`; never trust a `JSON.parse(...) as T` cast (ADR-0102/0105, `scripts/assert-boundary-decode.mjs`).
- Do not expose unrestricted IPC, arbitrary channels, shell execution, broad filesystem access, remote code, or raw internal errors.
- Use restrictive navigation, popup, and Content Security Policy controls.

## Cancellation and cleanup

- Long-running application and infrastructure operations accept `AbortSignal`.
- Check cancellation at defined stable boundaries.
- Never leave a partial artifact at the final output path.
- Clean temporary resources deterministically.
- Cancellation is distinct from content failure and must not alter already committed authoritative results.

## Security

- Apply source-size and nesting limits, path traversal defenses, validated output paths, safe temporary files, atomic writes, dependency review, vulnerability scanning, license checks, and secret scanning.
- Never compose shell commands from untrusted strings.
- Treat canonical content, mods, imported data, and saves as explicit trust classes.
- Offline operation is not a security boundary.

## Tests and acceptance

Use focused unit, invariant, property-based, metamorphic, compiler fixture, save/load, replay, child-process, cross-platform determinism, cancellation, architecture, and security tests. Add packaged Electron smoke tests when the desktop boundary exists.

A build alone is not evidence of authoritative correctness. For relevant work, prove:

- same inputs produce identical hashes;
- save/load preserves future outcomes;
- UI actions do not consume authoritative randomness;
- commands cannot bypass lifecycle constraints;
- ledgers balance;
- invariants hold after transitions;
- cancellation cleans up safely;
- canonical output is independent of OS ordering, locale, and timezone.

## ADR threshold

Create an ADR for decisions that materially constrain architecture, determinism, compatibility, persistence, security, or replacement cost. This includes package boundaries, numeric representation, RNG, canonicalization, hashing, persistence, command/event models, formula registry, migrations, Electron boundaries, major production dependencies, and approved deviations from the canonical design.

## Definition of done (machine-checked)

A change is done only when, on the exact commit:

- `pnpm preflight` is green — git state, single-copy `effect`, dependency policy, docs links/anchors/ADR index/deferrals/amendments, doc budgets, and no new `as unknown` casts (the gate DAG in `vite.config.ts` `run.tasks`, ADR-0164);
- `pnpm test:scripts` is green (the gate fixtures);
- `pnpm check` is green end-to-end (format, lint, `lint:effect`, licences, typecheck, build, tests, balance reports, desktop E2E);
- subjects are Conventional Commits, the working tree is clean, and the ticket's acceptance criteria are met.

Local git hooks run `preflight` and the commit-message check; CI re-runs everything and is the authority. Never weaken a gate or its fixtures to pass — fix the cause.

## Delivery contract

Every completed increment includes:

- implementation and focused tests;
- traceability updates;
- ADRs when required;
- exact validation commands and results;
- deterministic evidence where applicable;
- security and compatibility notes;
- known limitations and deferred requirements;
- changed-file summary;
- small Conventional Commits;
- pull-request description when remote access exists;
- a clean working tree.

Do not self-merge. Do not force-push. Do not weaken tests merely to pass CI.
