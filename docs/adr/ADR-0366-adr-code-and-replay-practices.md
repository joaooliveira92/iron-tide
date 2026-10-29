# ADR-0366: ADR, code and replay practices

Consolidates: ADR-0246, ADR-0268, ADR-0279, ADR-0280, ADR-0295, ADR-0318, ADR-0319, ADR-0336

Applies to: repository

Rule: Every current ADR states its rule and scope and supersedes acyclically; code carries no comments; the determinism baseline is an approval-gated replay corpus; debug screens stay internal.

## Status

Accepted (2026-10-30).

Supersedes: ADR-0246
Supersedes: ADR-0268
Supersedes: ADR-0279
Supersedes: ADR-0280
Supersedes: ADR-0295
Supersedes: ADR-0318
Supersedes: ADR-0319
Supersedes: ADR-0336

## Context

Three independent areas of documentation and process practice converged: the ADR corpus integrity rules (scope, rule lines, supersession acyclicity), the code-commenting ban, and the replay corpus that replaced the single-scenario golden as the determinism baseline. The replay corpus itself accumulated refinements: approval entries with change classes, property-based scenario generation, and war-bearing scenarios with player nation and start setup. This ADR consolidates their standing rules.

## Rules

1. **Replay corpus as determinism baseline.** The determinism baseline is a replay corpus: versioned replay files recorded from the production pack, each verified by re-executing through the real engine. Granularity is per-month checkpoints carrying for the command, event, random and financial ledgers the entry count and a hash per entry. The replay file is self-describing: format version, ruleset and compatibility versions, seed, content bundle hash (not the bundle), initial snapshot or the recipe deriving it, ordered command envelopes, `engineOptions`, any recorded interruption inputs, and per-month checkpoints. Checkpoints use a full-state hash of the canonically serialised whole snapshot, including `designs`, `designFamilies`, `prestigeRules` and `playerNationId`. The golden `golden/hashes.json` is retained as a smoke test only; a legacy probe is retired only after a mutation check shows the corpus catches the same class of break. (ADR-0246)

2. **Intentional change is an approval, not a re-pin.** An approval entry is bound to the exact old and new checkpoint hashes of one replay and month, states cause and migration assessment. `propose` builds it from the real diff; a guard in CI rejects an unmatched delta and any stale, orphaned or reused approval. CI never writes approvals. Corpus replays never use the `Golden-Repin` trailer or the ratchet baseline; approvals are the only path. (ADR-0246)

3. **Code carries no comments.** Names, types and tests state intent. Rationale lives in an ADR, the commit message or a test, never beside the code. A short allowlist survives: licence and attribution lines, shebangs, triple-slash references, test-runner pragmas, JSDoc type annotations in `.mjs` files, and the `test-focus-allow-skip` marker. Suppression directives stay only until their root cause is fixed. `pnpm strip:comments --check` runs in `pnpm preflight` and fails while any removable comment exists. No baseline exists: the tree is clean, so the ban is absolute. (ADR-0268)

4. **Replay approvals carry a change class.** Every approval has a required `changeClass`: `EXPECTED_GAMEPLAY_CHANGE`, `SERIALIZATION_ONLY` or `RULESET_VERSION_CHANGE`. Unexpected nondeterminism is not a class — it is a failure and is never approved. `propose` requires `--class`; an unknown class is refused. `check` verifies the claim against the replay files: `RULESET_VERSION_CHANGE` requires the replay's `rulesetVersion` to differ; `SERIALIZATION_ONLY` requires unchanged ruleset version, compatibility version and content hash, and every ledger of that month keeping its entry count. The approvals file lives at `replay-approvals/2`; version 1 is read only when it has no entries. (ADR-0279)

5. **Property-based replay scenarios.** Property-based scenarios use `fast-check` as a devDependency of `@bluewave/cross-process-test` only — no authoritative package, runtime-free package or app imports it. A scenario is a `CommandPlan` (list of months, each a list of `CommandPick` values). `planCommands` builds command bodies through the same shared constructor as seeded fuzz. Property tests always pass an explicit `seed` and `numRuns` to `fast-check`. The harness is mutation-checked: an injected extra random draw must fail the properties and shrink to the minimal plan. (ADR-0280)

6. **War-bearing replay scenarios.** A replay scenario may name a player nation and a deterministic start setup. `engineOptions` is a union: `{ kind: "default" }` or `{ kind: "player", playerNationId }`. The `initial` block may carry an optional `setup` naming a pure function from the production start snapshot. The only setup is `armed-adriatic-war`. A setup is test scaffolding over the production pack — it never writes to content, so no production balance value changes. `DeclareWar` and `MoveFleet` join the replay command-body union. (ADR-0295)

7. **ADR scope and governing docs.** Every ADR has an `Applies to:` line after its title: a comma-separated list of package names, `desktop`, `compiler-cli`, `content` or `repository` alone for repository-wide records. `scripts/lib/adr-scope.cjs` generates `docs/adr/by-scope/<scope>.md` for every scope, listing current records with their `Rule:` line and superseded records with their replacement. `pnpm adr:index` regenerates the pages. Every governing `AGENTS.md` links its generated by-scope page. `scripts/verify-adr-scopes.mjs` runs in `pnpm preflight` and fails when: an ADR has no valid scope, a relation is not reciprocated, a superseded record carries a `Rule:` line, a scope page is stale, a governing `AGENTS.md` is missing or does not link its page, or that doc cites an ADR that does not exist, an archived or superseded ADR without its replacement on the same line, or an ADR whose `Applies to:` omits that scope. ADR numbers are unique. (ADR-0318)

8. **Debug screens stay internal.** Simulation & Turn, Tactical Sandbox and Debugging & Telemetry remain debug tooling, classified `internal` in the reachability ledger. None is promoted or retired by this decision. The production renderer must not emit their chunks or register their routes; lazy imports are guarded by the compile-time `VITE_BLUEWAVE_DEBUG` flag. `apps/desktop/scripts/check-renderer-bundle.mjs` rejects a production renderer bundle that contains the three screen markers; debug builds skip that check. (ADR-0319)

9. **ADR corpus integrity.** Every current (non-superseded) ADR carries a non-empty `Rule:` line: one sentence stating what is authoritative now, citing no successor. Superseded records carry none. `scripts/adr-rule.baseline.json` lists the numbers of current records that predate this rule; the list only shrinks. The area map is single-valued — a number assigned to two areas fails `pnpm adr:index`. A supersession cycle over `Superseded by` edges fails the gate, naming the cycle. A higher ADR number never overrides a lower one; authority moves only through `Supersedes:` or `Amends:`, and a reader takes the resolved current record, not the newest number. (ADR-0336)