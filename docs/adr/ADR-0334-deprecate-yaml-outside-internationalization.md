# ADR-0334: Deprecate YAML outside internationalization

Applies to: repository

## Status

Superseded by: ADR-0361

Accepted (2026-10-29). Implemented the same day: the migration ratchet is empty
and the boundary gate runs in strict mode.

## Context

Authored YAML is the repository's only content surface, and it is not inert.
`content/production/1880/ship-building/components/**` carries 695 formula-typed
fields, 252 of them symbolic expressions that `@bluewave/ship-design` tokenises,
parses and evaluates at design-compile time
(`packages/ship-design/src/formula/{ast,parse,eval}.ts`). The compiler never checks
them: a misspelled identifier inside a production formula passes
`pnpm content:check` with exit 0 and no diagnostic, and is caught only by a unit
test in the consuming package that reports no file and no line. Diagnostics that
do exist point at `line: 1` of the authored file.

The string formulation has three separate costs, each observed in this tree:

1. **Unchecked programs.** `Schema.NonEmptyString` is the only "type" a formula
   has. Identifier resolution, unit sense, finite/integral/range results and
   placeholder metadata are all outside the schema.
2. **A second language.** ~500 lines of parser, evaluator, and two near-duplicate
   "re-derive the affine terms by sampling" readers, for 252 symbolic fields in
   eight shapes. No ADR records the language, and the engine writes strings to
   itself at ten sites (`evaluate(parseFormula("lookup(t, x)"), …)`).
3. **Leaked parser dependency.** 19 files import the `yaml` package directly; two
   runtime-free packages declare it (`campaign` as a production dependency it only
   uses from tests), and the desktop app declares it too.

The alternative - keep YAML for literal records and move only formulas to
TypeScript (the position recorded in issue #372) - leaves two authoring surfaces,
two editor and validation experiences, two provenance conventions and two
diagnostic qualities permanently, and keeps the YAML parser reachable from domain
packages. It also leaves the question "where does new content go?" open forever.

## Decision

1. **YAML is deprecated repository-wide.** It remains permitted only for
   internationalization catalogues, plus the externally mandated infrastructure
   files listed below. No new non-internationalization YAML file may be added.
2. **Authored domain content is constrained TypeScript.** Formulas, references,
   reusable definitions, invariants, balance values, literal records and
   provenance are authored as declarative `define…(...)` modules under
   `content/production/<pack>/`, using domain constructors from
   `@bluewave/content-authoring`. Property access is statically typed; a string
   reference (`ref("barrels")`) is allowed only at a serialization boundary.
3. **Generated artefacts are canonical JSON.** The compiled content artifact
   stays JSON through the existing versioned serializer
   (`@bluewave/deterministic`). YAML is never a generated format. A compatibility
   emission of YAML is not permitted by this ADR: the migration seam is in-memory
   documents handed to the compiler, not regenerated YAML files.
4. **Authored content does not execute inside compiler stages.** A content module
   is loaded at the IO boundary, its authored shape is decoded with an Effect
   `Schema`, and the resulting document enters the existing
   parse → validate → normalize → compile pipeline like any other document.
   Stages stay free of ambient I/O (`scripts/assert-no-stage-io.mjs`).
5. **The internationalization exception is mechanical.** YAML is allowed only when
   all six hold: translation keys and localized messages only; located under
   `content/production/<pack>/ui/`; consumed only by the UI-catalogue pipeline;
   no formulas, rules, balance values, executable expressions, gameplay or build
   configuration; the parser dependency stays inside that pipeline; and the
   boundary gate can decide it from the path alone.
6. **Externally mandated YAML is a separate, named exception.** A file whose format
   is imposed by a third-party tool is listed with the owning tool, the evidence
   of the requirement, and a review/removal condition. It may never carry
   application-owned data. Today: `pnpm-lock.yaml` and `pnpm-workspace.yaml` (pnpm),
   `.github/workflows/**` and `.github/dependabot.yml` (GitHub), and the vendored
   `.agents/**` skill tree (third-party files, excluded from formatting and lint).
   `apps/desktop/electron-builder.yml` is **not** in this category: the tool's own
   CLI help documents `json`, `json5`, `js` and `ts` configs as alternatives, so it
   is repository-owned configuration that must migrate.
7. **The boundary is enforced by a gate, not by convention.**
   `scripts/assert-no-foreign-yaml.mjs` walks the tracked tree, classifies every
   `.yaml`/`.yml` path, and fails on any foreign path that is not in a
   monotonically shrinking ratchet (`scripts/data/yaml-boundary.ratchet.json`).
   The ratchet reached zero the same day and the gate now runs in strict mode: the
   only accepted YAML is the localization catalogue and the infrastructure exceptions.
8. **Content modules are loaded at the IO boundary, not by the compiler stages.**
   `loadContentModule` imports the declared `.ts` entry, `fullSurface` hands the
   resulting document to `CompilerInput.documents`, and `ParseStage` prefers that
   document over any text. The parse stage accepts exactly three inputs: a loaded
   content module, a JSON document (test scaffolding and the pack manifest), and the
   `ui` catalogue. A `.yaml` path is rejected for every other group, in every pack
   type, so test fixtures build JSON documents rather than YAML text.

## Consequences

- All 89 authored content files (`content/production/1880/**`) are TypeScript
  modules; 922 YAML comments were carried into them, and every formula field that
  carried a confidence label now has typed `fieldProvenance`. The single
  internationalization catalogue (`content/production/1880/ui/en-US.yaml`, 136
  string→string entries, no numeric or domain data) stays. `content/ship-visual/parts.ts`
  and `apps/desktop/electron-builder.json` completed the inventory; the codemod's
  staged output is canonical JSON.
- `yaml` is now a dependency of `@bluewave/content-schema` only, used by the
  dedicated `parseUiCatalogue` loader in `content-schema/src/i18n.ts`.
- Every test that read production YAML now loads the authored module through the
  compiler's loader (`test-support` exposes `readAuthoredFile`/`readAuthoredDocument`;
  `content-schema` and `content-compiler` keep a local `createRequire` helper to avoid
  a build cycle). Every compiled fixture is a JSON document built by
  `test-support`'s `jsonDocument` and friends, and fragment builders were replaced by
  record builders, so no test writes YAML text at all. The one deliberate exception is
  `content-schema/test/yaml-parser.test.ts`, which tests the internationalization
  parser's own limits (aliases, tags, duplicate keys) and therefore must feed it YAML.
- The cross-process fixture documents changed format, so its content artifact hash and
  the bundle hash derived from it were re-pinned in `golden/hashes.json`; every
  gameplay hash (snapshot, ledgers, replay verification, battle generation) is
  unchanged, which is the evidence that the fixture change is serialization only.
- The `yaml` dependency now exists in `@bluewave/content-schema` alone, used by
  `parseUiCatalogue`. `content-schema/src/yaml-parser.ts` keeps its limits and policy
  for that one caller and is deleted if the localization catalogue ever moves to JSON.
  The codemod stages canonical JSON and no longer depends on `yaml`.
- `README.md`, `.ai/ENGINEERING-CONTRACT.md`, `RULES.md`,
  `docs/architecture/non-negotiable-rules.md`,
  `docs/architecture/canonical-content-and-rulesets.md`, `content/AGENTS.md` and
  `content/README.md` no longer claim that authored content is inert data.
- Bound hashes: migrating a file changes the artifact's `sourceFile` provenance
  string, so `content-lock.json` needs a deliberate refresh per migration; golden
  hashes must not move.

## Alternatives rejected

- **Keep YAML for literal records (issue #372's earlier position).** Two authoring
  surfaces, two validators and two provenance models forever, and the YAML parser
  stays reachable from domain packages.
- **Generate YAML from TypeScript so the pipeline never changes.** Keeps YAML as a
  generated format with no reader that prefers it, and doubles the artefact set.
- **Let compiler stages import content modules directly.** Executes authored code
  inside a stage that is required to be free of ambient I/O; rejected in favour of
  a boundary loader that decodes strict schemas.
- **Exempt all human-authored prose.** Narrative, rules, templates and research
  notes are not internationalization; a prose-shaped exception would swallow the
  whole inventory.
- **Allow a static allowlist of non-i18n YAML "for now".** That is how a migration
  becomes permanent; the ratchet plus the path gate fails closed instead.

## Removal criteria (definition of done)

The deprecation is complete when, in one repository state: the ratchet is empty;
`yaml` is a dependency only of the UI-catalogue path; `content-schema/src/yaml-parser.ts`
is deleted with its importers; `content-codemod/src/yaml.ts` is deleted or reduced to
the internationalization writer; no `pack.json` entry names a `.yaml` file outside
`ui/`; and `scripts/assert-no-foreign-yaml.mjs` runs in strict mode with the
infrastructure exception set only.
