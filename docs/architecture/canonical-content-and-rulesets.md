# Canonical content and rulesets

Domain content is authored as declarative TypeScript and compiled into a canonical
JSON artifact that the app runs on .
The distinction between **authored**, **compiled**, and **ruleset** data is a
load-bearing part of the determinism story.

## The pipeline

`@bluewave/content-compiler` runs explicit, statically ordered, typed, immutable
stages:

1. **Load and Parse** — the IO boundary loads every declared source. A TypeScript
   content module is imported, rendered to its document and decoded with its
   authored schema; YAML is parsed only for localization catalogues. `ParseStage`
   itself performs no ambient I/O (`scripts/assert-no-stage-io.mjs`) and receives
   already-loaded documents.
2. **Validate** — every record is decoded with `@bluewave/content-schema` (Effect
   Schema) and cross-references are checked. Diagnostics accumulate; downstream
   stages whose prerequisites are invalid are blocked.
3. **Normalize** — entities are sorted by stable id and units are converted to
   canonical engine units, so ordering never depends on declaration order.
4. **Compile** — the canonical artifact is serialized with the versioned
   serializer and named by its domain-separated SHA-256 body hash.

`content:check` validates without writing; `content:build` writes the artifact;
`content:verify` rebuilds in memory and fails on drift or tamper against the
committed content lock.

## The manifest declares the surface

`content/production/<scenario>/pack.json` is the single authority for the loaded
surface: `files` declares the pack/campaign collections, `shipBuilding` the
ship-building subtree. A file discovered but undeclared, or declared but missing,
fails the build.

## Formats

- **Authored:** constrained TypeScript under `content/production/<pack>/`, using
  declarative constructors from `@bluewave/content-authoring`. Formula fields are
  typed expressions over declared inputs; they render to the canonical expression
  text the runtime evaluator already understands, so a migration does not change
  an authoritative value. Files not yet migrated still fail the rule in the
  previous note and are listed in the ratchet.
- **Generated:** canonical JSON, written only by the compiler and never edited.
- **YAML:** permitted only for localization catalogues under
  `content/production/<pack>/ui/`, plus the externally mandated infrastructure
  files. `scripts/assert-no-foreign-yaml.mjs` fails on any other
  tracked `.yaml`/`.yml` outside the shrinking migration ratchet.

## Safety

- Authored content is data, not application code: a content module is a
  `define…(...)` call over literals and typed expressions, restricted by import
  allowlist and the determinism gate (`scripts/assert-authoritative-determinism.mjs`).
  It is decoded with a strict schema before any consumer sees it, and it never
  executes inside a compiler stage.
- Formulas are evaluated deterministically over declared inputs; the artifact
  carries the expression, so the value the player sees is explainable.
- YAML, where still permitted, is parsed without executable tags or arbitrary
  construction, with size, nesting, and alias limits (`parseYamlSafe`).
- The compiled artifact is inert JSON, verified before the app runs on it.
- Localized text never controls behaviour.
- Keep validation, normalization, and repair distinct: repair is explicit, narrow,
  logged, and limited to safely recomputable data.

## Rulesets

Ruleset constants (weather, gunnery, classification bands, build-time tables) are
versioned decisions carried on the snapshot, not ambient config. A ruleset change
is an authoritative change: it is versioned, recorded, and fail-closed on
mismatch. Content values that are not sourced carry an explicit confidence label —
`VERIFIED`, `DERIVED`, `ESTIMATE`, `BALANCE_TARGET`, or `PLACEHOLDER` — and a
`PLACEHOLDER` never reaches release.

See [`content/README.md`](../../content/README.md) and
[adding a nation](../agents/adding-a-nation.md).
