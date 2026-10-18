# Working in Bluewave (agent guide)

Bluewave is a deterministic 1880s naval strategy/tactical game: an engine, a
content compiler, and an Electron desktop app in one TypeScript monorepo. This
file is how an agent works here. It does not restate the binding authorities — it
points at them and adds the working conventions.

## Authority and reading order

Read, in order, before editing:

1. `README.md` — the canonical design baseline.
2. `.ai/ENGINEERING-CONTRACT.md` — the highest code authority.
3. `RULES.md` — the binding rules distilled from the above.
4. `.ai/REQUIREMENTS.md` and applicable ADRs (`docs/adr/`).
5. The current approved milestone brief (`.ai/SPRINT-PLAN.md`, `.ai/briefs/`).
6. The nearby code, tests, package exports, and CI — never assume they exist.

Precedence: safety/legal/credential constraints → canonical design → engineering
contract → ADRs → milestone brief → local conventions. On a genuine conflict,
**stop** (see Stop conditions) rather than resolving gameplay silently.

## Repository rules

- Check `git status` and the remote branch before mutating; `git pull --rebase`
  and run `pnpm preflight` at session start; rebase before every push.
- Never overwrite, revert, or reformat another contributor's work. Keep commits
  narrow and Conventional.
- Work concurrently in a dedicated worktree per effort: `pnpm worktrees new
  <slug>`; the live set is `.ai/WORKTREES.md`, and stale subtrees are pruned with
  `pnpm worktrees:prune` (ADR-0220).
- Review agents are read-only: they must not edit code, tests, commits, branches,
  or PR state.
- Standing standards docs carry a word ceiling in
  `scripts/doc-budgets.manifest.json`; ratchet down, justify any raise, and add
  new standing docs to the manifest.
- Record decisions that constrain architecture, determinism, compatibility,
  persistence, security, or replacement cost as ADRs; regenerate the index with
  `pnpm adr:index`.

## Determinism (the core invariant)

Identical content, ruleset, inputs, commands, seeds, and compatibility versions
produce identical authoritative hashes across OSes.

- Authoritative packages must not read `Math.random`, random UUIDs, wall-clock
  time, `process.env`, locale/timezone, filesystem order, network/hostname/pid/
  scheduler, mutable globals, or platform path separators. Inputs enter through
  validated requests or explicit ports.
- Use hierarchical, domain-separated RNG only — never a generic `nextRandom()`.
  Every random outcome records stream identity, stable entity key, phase, ruleset
  version, input hash, draw/derived value, outcome, and reason code.
- Authoritative outcomes use integer or fixed-point maths: branded safe-integer
  unit types, checked arithmetic, explicit bounds and rounding; reject
  non-integers and unsafe integers at construction.
- Use a versioned canonical serializer with defined key/collection ordering,
  Unicode normalization, and integer representation; SHA-256 with
  domain-separated envelopes. Never treat JavaScript insertion order as canon.

## Effect source of truth

- `effect@4.0.2` is vendored under `vendor/effect`; read the installed source and
  declarations before relying on behaviour. Import `effect` (or `effect/<Subpath>`),
  never the npm registry and never `repos/`; the single-copy guard is enforced.
- Runtime-free subset: `Schema`, `SchemaIssue`, `Data`, `Equal`, `Hash`, `Option`,
  `Predicate`, `Result`. The full runtime lives only at IO/entrypoint boundaries —
  `persistence`, `content-compiler`, `apps/desktop/src/main`, `apps/compiler-cli`.
  The renderer and preload import no `effect`. See
  [runtime-free gate](docs/agents/runtime-free-gate.md).

## Errors

- In-process domain errors: `Data.TaggedError`; serializable/wire errors:
  `Schema.TaggedError`. Give every typed failure a stable `_tag`.
- Discriminate with `_tag`, never `instanceof`. Handle each failure at its call
  site with `Effect.catchTag`/`catchTags`/`catchReason`; do not add shared error
  transformers or guards that probe the failure channel. No `Effect.orDie` except
  where recovery is intentional.
- Tests discriminate by `_tag` too. The one sanctioned class-based test form is
  `expect(fn).toThrow(ErrorClass)`.

## Schema and boundaries

- Effect Schema is the single validator at every boundary (Zod was replaced).
  `Schema.Struct` **strips** excess keys by default; reject them by decoding with
  `{ onExcessProperty: "error" }`.
- Never trust an external boundary: decode compiled YAML, saves, IPC/event
  envelopes, and file contents with a strict schema before use. Never assert a
  boundary with `JSON.parse(...) as T`. See [domain](docs/agents/domain.md).
- Wire formats are frozen; every schema change carries a parity test built from
  the existing fixtures. Never dual-maintain two validators. See
  [Effect Schema patterns](agent-patterns/effect-schema.md).

## Content and compiler

- Author content in YAML without executable tags; compile it into canonical
  artifacts. The manifest declares roots, collections, dependencies, versions,
  localization, and production/fixture classification.
- Compiler stages are explicit, statically ordered, typed, immutable, and free of
  ambient I/O, randomness, and final-artifact writes. Accumulate diagnostics and
  block downstream stages whose prerequisites are invalid.
- Keep validation, normalization, and repair distinct: repair is explicit,
  narrow, logged, and limited to safely recomputable data. See
  [canonical content and rulesets](docs/architecture/canonical-content-and-rulesets.md).

## Services, layers, composition

- Model stable dependencies with `Context.Service`; pass per-call input as
  arguments. Resolve dependencies once while the Layer is built and close over
  them, so a method is `Effect<A, E, never>` unless the dependency is genuinely
  per-call (say why).
- Name stored layers `layer`/`layerX`; PascalCase for types/services/schemas/error
  classes, camelCase for other values. Use `.pipe(...)` for linear composition and
  `Effect.gen` for sequential workflows; run synchronous code directly inside
  `Effect.gen`. Keep execution inside Effect (`Deferred`/`Queue`/`FiberSet`, not
  `runPromise`), and log with `Effect.log*`, never `console.*`.

## Tests and gates

- Red, Green, Refactor. A bug is unconfirmed until an observable regression test
  fails for the expected reason before the fix and passes after.
- Tests run on `vite-plus/test`; exercise production composition and replace only
  true external boundaries. Never use sleeps as synchronization or tests whose
  runtime depends on wall-clock time.
- Definition of done on the exact commit: `pnpm preflight`, `pnpm test:scripts`,
  and `pnpm check` all green; clean tree; Conventional Commit subjects; the
  ticket's acceptance criteria met. Never weaken a gate or its fixtures to pass —
  fix the cause. Golden artefacts are re-pinned deliberately: see
  [golden repinning](docs/agents/golden-repinning.md).

## Git policy

- Work on a short-lived branch in a dedicated worktree; never commit on `dev` or
  `main`. Deliver by a checks-green pull request; never self-merge a release PR.
- Do not force-push or rewrite history; never commit secrets, `.env` files,
  stores, caches, or machine-specific settings. End a milestone tree-clean.
- Use `pnpm change-scope` for change-based filtering: see
  [change scope](docs/agents/change-scope.md).

## Vendored repositories

`vendor/` and `repos/` are read-only reference material (byte-identical upstream
artifacts) — never lint, reformat, or import from them. `repos/` may be absent in
a normal checkout.

## Stop conditions

Stop and write a decision request (`.ai/templates/decision-request.md`) when: two
plausible interpretations change gameplay; the design contradicts itself; required
high-authority content is missing; a repair would fabricate canonical information;
a migration changes authoritative outcomes unapproved; a fix materially expands
scope into a deferred subsystem; destructive data operations or history rewriting
would be required; credentials/secrets/signing/publishing are implicated; a
dependency raises a material licence or security concern; or determinism cannot be
demonstrated or a golden hash changes without an understood authoritative cause.

Do not stop for routine local design choices — record the constraining ones as
ADRs. The orchestration pipeline (chart → research → spec → slice → implement →
review → gate) is in `.ai/ORCHESTRATION.md`.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`joaooliveira92/iron-tide`), driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles with default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: the root `GLOSSARY-MAP.md` points to per-context `GLOSSARY.md` files; system ADRs in `docs/adr/`. See `docs/agents/domain.md`.
