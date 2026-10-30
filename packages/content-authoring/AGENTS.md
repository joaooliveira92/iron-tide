# @bluewave/content-authoring

**Role:** Declarative authoring API for domain content: typed expressions, provenance, constructors.

**Class:** runtime-free

**Boundary:** Content modules only. Produces plain documents that `content-schema` validates; depends on `content-schema` and the runtime-free `effect` subset.

**Invariants:**

- Formula fields are typed terms over declared inputs; the rendered document is canonical expression text, never a hand-written string.
- Provenance is data: a placeholder, estimate or derived value without a rationale is rejected at construction.
- Constructors may not hide a tuning coefficient.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Test: `pnpm --filter @bluewave/content-authoring test`.
