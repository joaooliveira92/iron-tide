# Bluewave Repository Rules

Read this before any work. It distills the binding authorities — `README.md`
(canonical design), `.ai/ENGINEERING-CONTRACT.md`, and `AGENTS.md` — into the
rules every change must satisfy. If this file and a contract disagree, the
contract wins; fix this file in the same change.

## Coordination

- Check `git status` and the remote branch before mutating; `git pull --rebase`
  and run `pnpm preflight` at session start; rebase before every push.
- Never overwrite, revert, or reformat another contributor's work. Keep commits
  narrow and Conventional.
- Use one production owner for overlapping files. Review agents are read-only:
  they must not edit code, tests, commits, branches, or PR state.

## Authority and docs

- `README.md` is binding. Do not reinterpret gameplay, invent canonical content,
  or weaken validation to accommodate fixtures. On genuine contract ambiguity,
  stop and raise a decision rather than silently choosing.
- Standing standards docs carry a word ceiling in
  `scripts/doc-budgets.manifest.json`; ratchet down and justify any raise. Add
  new standing docs to that manifest.
- There are no ADRs. A rule that a gate, type or test can enforce lives in that
  gate, type or test. A rule nothing can enforce is a line in this file or in the
  owning package's `AGENTS.md`. Rationale goes in the commit message.
- An artifact that never existed in reachable git history is an unverified legacy
  reference; never recreate it from its filename.
- An `ADR-NNNN` citation in content provenance, research notes or a test refers to
  a record deleted from the tree. Read it with `git show 13aaced9:docs/adr/ADR-NNNN-*.md`.

## Determinism

- Identical content, ruleset, inputs, commands, seeds, and compatibility
  versions must produce identical authoritative hashes across supported OSes.
- Authoritative packages must not read `Math.random`/random UUIDs, wall-clock
  time, `process.env`, locale/timezone, filesystem order, network/hostname/pid/
  scheduler, mutable globals, or platform path separators. Required inputs enter
  through validated requests or explicit ports.
- Use hierarchical, domain-separated RNG only; never a generic `nextRandom()`.
  Every random outcome records stream identity, stable entity key, phase,
  ruleset version, input hash, draw or derived value, outcome, and reason code.
- Authoritative outcomes use integer or fixed-point math: branded safe-integer
  unit types, checked arithmetic, explicit bounds and rounding; reject
  non-integers and unsafe integers at construction. Add `bigint` only after
  documented bound analysis.
- Use a versioned canonical serializer with defined key/collection ordering,
  Unicode normalization, and integer representation. SHA-256 with
  domain-separated envelopes. Never treat JavaScript insertion order as canon.

## Effect source of truth

- `effect@4.0.2` is vendored. Read `vendor/effect` and `repos/effect/LLMS.md`
  plus the relevant `repos/effect/packages/*` source before relying on behavior;
  installed source and declarations are the truth.
- Import `effect` (or `effect/<Subpath>`), never the npm registry and never
  `repos/`. The single-copy guard is enforced.
- Runtime-free subset: `Schema`, `SchemaIssue`, `Data`, `Equal`, `Hash`,
  `Option`, `Predicate`, `Result`. The runtime-free roots in
  `scripts/assert-runtime-free.mjs` import nothing else from `effect`. The full
  runtime lives only at IO/entrypoint boundaries — `persistence`,
  `content-compiler`, and the two app surfaces `apps/desktop/src/main` and
  `apps/compiler-cli`; the renderer and preload import no `effect`.

## Errors

- In-process domain errors: `Data.TaggedError`. Serializable/wire errors:
  `Schema.TaggedError`. Give every typed failure a stable `_tag`.
- Discriminate with `_tag`, never `instanceof`. Handle each failure at its call
  site with `Effect.catchTag`/`catchTags`/`catchReason`; do not add shared error
  transformers or guards that probe the failure channel. No official
  `Effect.orDie` or equivalent — select the branch and `Effect.die(error)` only
  where recovery is intentional. Preserve interruption and structured context;
  keep `unknown` out of error and requirement channels.
- Tests discriminate by `_tag` too (`isBluewaveError`, or a local structural
  `_tag` guard), never `instanceof`/`toBeInstanceOf(SomeDomainError)`. The one
  sanctioned class-based test form is the matcher `expect(fn).toThrow(ErrorClass)`
  / `toThrowError(ErrorClass)`; `expect(x).toBeInstanceOf(Error)`
  (the global `Error`) is out of scope.

## Schema and boundaries

- Effect Schema is the single validator at every boundary (Zod was replaced).
  `Schema.Struct` **strips** excess keys by default
  (`onExcessProperty: "ignore"`, matching non-strict `z.object`); reject them by
  decoding with `{ onExcessProperty: "error" }`.
- Never trust an external boundary: decode compiled YAML, saves, IPC/event
  envelopes, and file contents with a strict schema before use.
- Wire formats are frozen. Every schema change carries a parity test built from
  the existing fixtures. Never dual-maintain Zod and Effect Schema.

## Content and compiler

- Author domain content as declarative TypeScript modules and compile it into
  canonical JSON artifacts. YAML is permitted only for internationalization
  catalogues and for externally mandated infrastructure files;
  new non-internationalization YAML fails `scripts/assert-no-foreign-yaml.mjs`.
  The manifest declares roots, collections, dependencies, versions,
  localization, and production/fixture classification.
- Compiler stages are explicit, statically ordered, typed, immutable, and free
  of ambient I/O, randomness, and final-artifact writes. Accumulate diagnostics
  and block downstream stages whose prerequisites are invalid.
- Keep validation, normalization, and repair distinct. Repair is explicit,
  narrow, logged, and limited to safely recomputable data.

## Scope and values

- The sole start year is 1880 and the authored horizon is 1970. A declared scenario
  with no content pack is not selectable. The 1880 release has fourteen committed
  nations; ten are playable and the other four stay AI-only until each passes the
  per-nation readiness gate.
- Authoritative values are canonical fixed-precision types with one rounding
  vocabulary. Units, currency and locale convert only at the presentation boundary.
- Every authored value cites a source or is labelled `BALANCE_TARGET`/`PROVISIONAL`.
  Content must not promise behaviour the engine lacks.
- Every number the player sees derives its explanation from stored components or the
  rule that produced it. Explanation trees are additive persisted fields outside the
  authoritative hash.

## Dormant by decision

Engine capabilities with no desktop path stay dormant until a ticket wires them:
aircraft and carriers, air combat, mines, submarines, coastal defence, smoke and
surface-to-surface missiles. `scripts/data/reachability-ledger.json` lists each one
and `scripts/verify-reachability-ledger.mjs` fails when a row drifts.

## Services, layers, composition

- Model stable dependencies with `Context.Service`; pass per-call input as
  function arguments. Resolve dependencies once while the Layer is built and
  close over them, so a service method is `Effect<A, E, never>` unless the
  dependency is genuinely per-call (say why at the definition).
- Name stored `Layer.Layer` values `layer` or `layerX` (PascalCase suffix); use
  PascalCase for types, services, schemas, and error classes, camelCase for
  other values and functions.
- Use `.pipe(...)` for linear composition and `Effect.gen` for sequential
  workflows. Inside `Effect.gen`, execute synchronous code directly — never
  `yield* Effect.sync(...)`. Use `Effect.sync` only for a non-throwing sync side
  effect and `Effect.suspend` when the thunk returns an Effect.
- Keep execution inside Effect: no `runPromise`/`runFork`/`runSync` from within
  Effect code — bridge with `Deferred`, `Queue`, or `FiberSet`. Log with
  `Effect.log*`, never `console.*`. Add `Effect.fn`/`withSpan` spans with stable
  names at workflow and IO boundaries.

## Tests and gates

- Red, Green, Refactor. A bug is unconfirmed until an observable regression test
  fails for the expected reason before the fix and passes afterward.
- Tests run on `vite-plus/test`. Exercise production composition; replace only
  true external boundaries. Never use sleeps as synchronization or tests whose
  runtime depends on wall-clock time.
- Definition of done on the exact commit: `pnpm preflight`, `pnpm test:scripts`,
  and `pnpm check` all green; clean tree; Conventional Commit subjects; the
  ticket's acceptance criteria met. Never weaken a gate or its fixtures to pass —
  fix the cause.
