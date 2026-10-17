# R-23: UI-string content catalogue path under ADR-0209

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

How would an en-US UI/message catalogue be authored, declared, and compiled as
content under ADR-0209 — and what is the minimal path that keeps the projection
package runtime-free while the renderer resolves keys?

Specifically:

- The content manifest (`pack.json`) roots/collections and whether a UI/string
  collection is already declared anywhere.
- `packages/content-schema` / `packages/content-compiler` conventions for adding a
  new collection and validating it; whether any localization catalogue scaffolding
  exists (ADR-0209 status: accepted, unimplemented).
- How the renderer currently obtains presentation content
  (`inspectPresentationContent`) and where a key→en-US resolver would live.
- The fallback/dev-warning mechanics ADR-0209 mandates and how "no raw keys in
  production" would be enforced.

## Answer

**Resolved — no UI/string catalogue exists anywhere today; the path is a direct
copy of the `presentation.yaml` pipeline.** Keys/fallback are defined only by
D-13 and ADR-0209.

Minimal path:
1. **Author** `content/production/1880/ui/en-US.yaml` (locale + `Strings` record),
   mirroring `presentation.yaml`.
2. **Declare** in `content/production/1880/pack.json` under `files` as
   `"ui": ["ui/en-US.yaml"]` — the `files` map is open, no manifest-schema change
   (`content-schema/src/manifest.ts:9`).
3. **Schema** a new `packages/content-schema/src/ui-catalogue.ts` and add
   `ui: Schema.optional(UiCatalogueSchema)` to `ContentBundleSchema`
   (`content-bundle.ts:69-82`); export from `src/index.ts`; test excess-key
   rejection like `presentation.test.ts`.
4. **Compiler** — add `uiFiles?: string[]` (`content-compiler/src/index.ts:81`),
   map in `fullSurface.ts:216`, add `"ui"` to `OBJECT_GROUPS`/`fileGroups`
   (`parse.ts:43,88`), validate (mirror `validatePresentation`, `validate.ts:306-317`),
   normalize (`normalize.ts:36,107`), land in `compile.ts:117-125` / `artifact.ts`;
   re-pin `content/production/1880/content-lock.json`.
5. **Boundary** — DTO + command (extend `inspectPresentationContent` or add
   `inspectUiCatalogue`, `contentCommands.ts:31-39`) and a
   `ContentArtifact.loadUiCatalogue` (`contentArtifact.ts:66,106-107`) mirroring
   `presentationContent.ts:12-21`.
6. **Renderer resolver** — new `apps/desktop/src/renderer/content/uiCatalogue.ts`
   mirroring `presentationContent.ts:36-55`, reading `preferences.language`
   (`preferences-context.tsx:132`); fallback per ADR-0209 (`:24-25`), never a raw
   key in production.
7. **Runtime-free preserved** — catalogue is data-only; projection stores only
   `titleKey`/`bodyKey`/`interpolation` (D-13).

**Precedent:** `preferences-contract.ts:68-74` (`CURRENCY_FALLBACK_REASONS`, "U-3
maps these to localized messages") is the stable-code-now, prose-later pattern.
ADR-0209 and ADR-0218 confirm presentation conversion lives renderer-side only.
