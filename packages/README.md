# Packages

22 TypeScript composite projects. **Authoritative sources:**

- **Boundaries** — each package's `AGENTS.md` states its boundary and invariants.
- **Vocabulary** — [CONTEXT.md](../CONTEXT.md).
- **Non-negotiable rules** — [`DESIGN-57`](../docs/architecture/non-negotiable-rules.md).

Rules: the graph is directed and acyclic, leaf primitives at the bottom and the
phase engine composing them; import only a package's public `exports`
(`src/index.ts`), never another package's source. Read a package's `AGENTS.md`
before editing it. Build/test one with `pnpm --filter @bluewave/<name> <build|test>`.

| Package | Role |
| --- | --- |
| `contracts` | Branded `SafeInt` types, checked arithmetic, rounding. Graph root. |
| `diagnostics` | Diagnostic collector, stable codes. |
| `deterministic` | Canonical JSON, SHA-256, hash contexts, envelopes, fixed-point math. |
| `armament` | Platform-independent authoritative armament domain + resolver. |
| `random` | Domain-separated seeded PRNG with an audit ledger. |
| `content-authoring` | Typed content-authoring API: expressions, provenance, constructors. |
| `content-schema` | Effect `Schema` definitions + safe YAML parser for packs, rulesets, entities. |
| `content-compiler` | Parse → validate → normalize → compile stages with diagnostics. |
| `campaign` | Campaign compiler and state aggregates (world, nations, fleets, war…). |
| `ship-design` | Component-level ship compiler (DESIGN-21/63). |
| `ship-visual` | Presentation-only ship visual parts: era/nation part catalog, resolver, placement. Renderer-only. |
| `messages` | Turn interruptions, decision requests, recorded inputs, message aggregation. |
| `content-codemod` | Legacy-to-parts content codemod; stages content, never activates production. |
| `commands` | Command envelopes, 7-step lifecycle, authorization, ledger, reason codes. |
| `events` | Domain event envelopes, explanation trees, ledger. |
| `combat` | Deterministic tactical battle engine and auto-resolution. |
| `ai` | Legal-only uniform-random AI planning via keyed RNG. |
| `persistence` | Content-addressed atomic save/load, snapshots, recovery. |
| `phase-engine` | Ordered monthly turn pipeline (20 phases), replay verifier, ledger. |
| `campaign-engine` | Desktop read-only projections + `campaign:execute` bridge. |
| `test-support` | Fixture helpers. |
| `cross-process-test` | Cross-process determinism harness. |

Applications live in [apps/](../apps/README.md).
