---
name: improve-effect-use
description: Scan a codebase for gaps against Effect v4 idioms, turn them into tickets via to-tickets, then grill through whichever one you pick.
---

# Improve Effect Use

Surface **gaps** between the code and Effect v4 as vendored here, and propose refactors that close them. The aim is typed failures, honest requirements, scoped resources, and tests that never wait on a real clock.

Repo rules outrank every domain file. Read first:

- `AGENTS.md`: "Effect source of truth", "Errors", "Services, layers, composition", "Schema and boundaries".
- `docs/agents/runtime-free-gate.md`: which packages may import the runtime.
- `GLOSSARY.md` files and ADRs in the area you touch. Do not re-litigate an ADR; surface a conflict only when the friction is real, and mark it in the ticket.

`vendor/effect/src` is the final authority for every API name you cite. `vendor/effect/AGENTS.md` and `vendor/effect/ai-docs/src` show the intended idiom. The model's memory of Effect is v3; trust the source.

## Vocabulary

Use these terms exactly.

**Gap**: a place where the code diverges from the v4 idiom. Four kinds:

- **Drift**: a v3 or legacy API still in use. See [V4-DRIFT.md](V4-DRIFT.md).
- **Leak**: something escapes its owner: a requirement in a service method, a resource past its scope, a fiber past its parent, a failure swallowed out of the error channel.
- **Bypass**: hand-rolled code where an Effect module already exists (a `setTimeout` loop for `Schedule`, a `Map` memo for `Cache`, `Date.now` for `Clock`).
- **Misplaced run**: `Effect.run*`, `ManagedRuntime`, or a full-runtime import away from an **edge**, or inside a runtime-free package.

**Edge**: an IO or entrypoint module where the full runtime is allowed (the list lives in AGENTS.md). **Channel**: one of the success, error, or requirements slots of `Effect<A, E, R>`.

**Replacement test**: apply it to every Bypass. Would the Effect module delete code, or only rename it? Only deletions count.

**Leak test**: apply it to every service. A method whose `R` is not `never`, or a public effect that still needs `Scope`, is a leak unless the signature says why.

## Process

### 1. Explore

**Scope before you scan: YAGNI.** Closing a gap pays off where code keeps changing. Decide where to look first:

- If the user named a direction (a package, a domain, a pain point), take it.
- Otherwise walk back through `git log --oneline` for hot spots and let those paths pull attention first. If changes are scattered, widen the net.

Gates already enforce part of this repo's Effect rules (`scripts/assert-tagged-errors.mjs`, `assert-no-library-console.mjs`, `assert-single-effect.mjs`, `assert-runtime-free.mjs`, `assert-boundary-decode.mjs`). Skip what a gate catches. Report a real case a gate misses as a **gate gap**.

Then spawn one sub-agent per cluster, in parallel. Give each the scope, the repo rules above, and its cluster's domain files:

| Cluster | Domains |
| --- | --- |
| Failure and lifetime | [error-management](domains/error-management.md), [scheduling](domains/scheduling.md), [concurrency](domains/concurrency.md), [resource-management](domains/resource-management.md) |
| Composition and edges | [requirements-management](domains/requirements-management.md), [runtime](domains/runtime.md), [configuration](domains/configuration.md), [platform](domains/platform.md), [testing](domains/testing.md) |
| Data and contracts | [schema](domains/schema.md), [data-types](domains/data-types.md), [trait](domains/trait.md), [behaviour](domains/behaviour.md), [coding-style](domains/coding-style.md) |
| Flow and state | [stream](domains/stream.md), [sink](domains/sink.md), [batching](domains/batching.md), [caching](domains/caching.md), [state-management](domains/state-management.md), [observability](domains/observability.md) |

Each domain file opens with its **Signals**: greps that show the domain is in play, and absences that show it should be. A sub-agent reads a domain file once a signal fires. It is done when every domain in its cluster has either been read or returned empty signals, and its report lists each domain as `hits` or `clean`. Explore organically beyond the greps and note where Effect code strains:

- Where does a caller handle a failure the signature never declared?
- Where does a test need a real clock, a real file, or the whole app to exercise one service?
- Where does one concept's lifecycle (acquire, run, release) span several files?

Verify every candidate before it becomes a ticket. Grep `vendor/effect/src` for each API it names and cite `path:line`. Drop a candidate whose fix would import the runtime into a runtime-free package. Grep the tests and ADR references for a name or comment that pins the opposite behaviour ("strips", "accepts", "open"); when the repo contradicts itself, raise a decision request.

### 2. Turn candidates into tickets

Do not write a report file. Hand the verified candidates to [to-tickets](../to-tickets/SKILL.md): read it and follow its process (draft vertical slices, quiz the user, publish to the configured tracker). `to-tickets` is not model-invocable, so read the file rather than calling the Skill tool.

Each candidate becomes one ticket, or an expand–contract sequence when it is a wide refactor. Carry these into the ticket:

- **Title**: names the closed gap (e.g. "Give the save store a scoped handle").
- **What to build**: the gap kind and domain, the problem in one sentence, and the direction naming the Effect API with its `vendor/effect/src/<Module>.ts:line`.
- **Acceptance criteria**: the channel, lifetime, or test that improves ("Failure joins the error channel", "Requirements shrink to never", "Finalizer runs on interrupt", "Test drops real timers"), plus a red-then-green regression test. Never "cleaner" or "more idiomatic".
- **Recommendation strength**: `Strong`, `Worth exploring`, or `Speculative`, stated in the quiz. Only `Strong` and `Worth exploring` tickets get `ready-for-agent`.
- **Risk tags** in the body, where they apply: `authoritative` (feeds authoritative hashes), `golden-hash` (could move a pinned artefact), `wire-format` (changes a frozen schema or envelope), `runtime-free` (stays inside the allowlisted `effect` subset), `edge` (lands in `persistence`, `content-compiler`, `apps/desktop/src/main`, or `apps/compiler-cli`).
- **ADR conflict**, if any, as one line.

A candidate that would change an authoritative hash, a wire format, or a golden artefact is a Stop condition in AGENTS.md. Never label it `Strong` or `ready-for-agent`; publish it as a decision request using `.ai/templates/decision-request.md`.

List real **gate gaps** (cases an existing gate script misses) as their own ticket naming the gate.

Close the quiz with a **Top recommendation**: the one ticket to start with, and why in one sentence.

Do NOT write the refactor yet. `to-tickets` ends at publishing; when the user picks a ticket to explore, continue below.

### 3. Grilling loop

Once the user picks a ticket, call the Skill tool with "grilling" to walk the decision tree with them: which channel changes, who owns the lifecycle, what the edge looks like, which tests survive.

Side effects happen inline as decisions crystallize; call the Skill tool with "domain-modeling" to keep the domain model current:

- **Naming a service, error, or layer after a concept missing from `GLOSSARY.md`?** Add the term.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR so future reviews skip it. Skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **A constraining decision about determinism, persistence, or replacement cost?** Record it as an ADR (`pnpm adr:index` regenerates the index).
- **Ready to build?** Call the Skill tool with "tdd": one gap per short-lived branch, red before green. Commits that touch authoritative source need a `Golden-Repin` trailer ([golden repinning](../../../docs/agents/golden-repinning.md)); `pnpm format:fix` fixes formatting, and `node scripts/verify-no-unknown-casts.mjs --prune` retires baseline entries a refactor removed.
