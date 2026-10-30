# ADR-0361: Deprecate YAML outside internationalization

Consolidates: ADR-0334

Applies to: repository

Rule: YAML is reserved for internationalization catalogues and mandated infrastructure; all other authored content is declarative TypeScript under constrained domain constructors.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0334

## Context

Authored YAML was the repository's only content surface and it was not inert. The compiler never checked symbolic expressions embedded in YAML strings: a misspelled identifier inside a production formula passed `pnpm content:check` with exit 0. Keeping YAML for literal records while moving only formulas to TypeScript would leave two authoring surfaces, two editor experiences, two provenance conventions and two diagnostic qualities permanently, and keep the YAML parser reachable from domain packages.

## Decision

1. **YAML is deprecated repository-wide.** It remains permitted only for internationalization catalogues, plus externally mandated infrastructure files. No new non-internationalization YAML file may be added.

2. **Authored domain content is constrained TypeScript.** Formulas, references, reusable definitions, invariants, balance values, literal records and provenance are authored as declarative `define…()` modules under `content/production/<pack>/`, using domain constructors from `@bluewave/content-authoring`. Property access is statically typed; a string reference is allowed only at a serialization boundary.

3. **Generated artefacts are canonical JSON.** The compiled content artifact stays JSON through the existing versioned serializer (`@bluewave/deterministic`). YAML is never a generated format.

4. **Authored content does not execute inside compiler stages.** A content module is loaded at the IO boundary, decoded with an Effect `Schema`, and the resulting document enters the existing parse → validate → normalize → compile pipeline. Stages stay free of ambient I/O.

5. **The internationalization exception is mechanical.** YAML is allowed only when all six hold: translation keys and localized messages only; located under `content/production/<pack>/ui/`; consumed only by the UI-catalogue pipeline; no formulas, rules, balance values, executable expressions, gameplay or build configuration; the parser dependency stays inside that pipeline; and the boundary gate can decide it from the path alone.

6. **Externally mandated YAML is a separate, named exception.** A file whose format is imposed by a third-party tool is listed with the owning tool, the evidence of the requirement, and a review/removal condition. Today: `pnpm-lock.yaml` and `pnpm-workspace.yaml` (pnpm), `.github/workflows/**` and `.github/dependabot.yml` (GitHub), and the vendored `.agents/**` skill tree.

7. **The boundary is enforced by a gate, not by convention.** `scripts/assert-no-foreign-yaml.mjs` walks the tracked tree, classifies every `.yaml`/`.yml` path, and fails on any foreign path that is not in a monotonically shrinking ratchet. The ratchet reached zero and the gate now runs in strict mode.

8. **Content modules are loaded at the IO boundary, not by compiler stages.** `loadContentModule` imports the declared `.ts` entry, `fullSurface` hands the resulting document to `CompilerInput.documents`, and `ParseStage` prefers that document over any text. The parse stage accepts exactly three inputs: a loaded content module, a JSON document, and the `ui` catalogue.

## Consequences

- All 89 authored content files are TypeScript modules; 922 YAML comments were carried into them. Every formula field that carried a confidence label now has typed `fieldProvenance`.
- `yaml` is now a dependency of `@bluewave/content-schema` only, used by the dedicated `parseUiCatalogue` loader.
- Every test that read production YAML now loads the authored module through the compiler's loader. No test writes YAML text.
- The cross-process fixture documents changed format, so content artifact hashes were re-pinned in `golden/hashes.json`; every gameplay hash is unchanged.
- `README.md`, `.ai/ENGINEERING-CONTRACT.md`, `RULES.md`, `docs/architecture/non-negotiable-rules.md`, `docs/architecture/canonical-content-and-rulesets.md`, `content/AGENTS.md` and `content/README.md` no longer claim authored content is inert data.