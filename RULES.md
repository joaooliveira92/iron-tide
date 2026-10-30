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
- Record decisions that constrain architecture, determinism, compatibility,
  persistence, security, or replacement cost as ADRs (threshold in the contract).

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
  `apps/compiler-cli` (ADR-0159); the renderer and preload import no `effect`.

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
  / `toThrowError(ErrorClass)` (ADR-0152 §6); `expect(x).toBeInstanceOf(Error)`
  (the global `Error`) is out of scope.

## Schema and boundaries

- Effect Schema is the single validator at every boundary (Zod was replaced,
  ADR-0102/0105). `Schema.Struct` **strips** excess keys by default
  (`onExcessProperty: "ignore"`, matching non-strict `z.object`); reject them by
  decoding with `{ onExcessProperty: "error" }` (ADR-0104 §3, ADR-0105 §2).
- Never trust an external boundary: decode compiled YAML, saves, IPC/event
  envelopes, and file contents with a strict schema before use.
- Wire formats are frozen. Every schema change carries a parity test built from
  the existing fixtures. Never dual-maintain Zod and Effect Schema.

## Content and compiler

- Author domain content as declarative TypeScript modules and compile it into
  canonical JSON artifacts (ADR-0334). YAML is permitted only for
  internationalization catalogues and for the externally mandated infrastructure
  files ADR-0334 names; new non-internationalization YAML fails the boundary gate.
  The manifest declares roots, collections, dependencies, versions,
  localization, and production/fixture classification.
- Compiler stages are explicit, statically ordered, typed, immutable, and free
  of ambient I/O, randomness, and final-artifact writes. Accumulate diagnostics
  and block downstream stages whose prerequisites are invalid.
- Keep validation, normalization, and repair distinct. Repair is explicit,
  narrow, logged, and limited to safely recomputable data.

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
