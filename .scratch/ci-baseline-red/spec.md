# Spec: CI base-line red on `dev`

**Status:** ready-for-agent (two tickets) · **Issues:** `issues/` · **Origin:** found
when the USA playable-roster PR (#6) first ran CI on the integration branch `dev`.
All failures reproduce on the untouched base commit `ae05b90`.

## Problem Statement

CI is red on the integration branch `dev` for reasons unrelated to any feature
branch. Two independent defects make `Quality`, `Gates (cross-OS)` and
`Determinism Gate (windows-latest)` fail even on a clean `dev` push, so no PR can
be checks-green until they are fixed.

## Defects

1. **`pnpm preflight` races the workspace build.** The
   `gate:codemod-determinism` gate runs `packages/content-codemod` tests that
   import workspace packages whose published entry is their built `dist/`
   (`@bluewave/ship-design`, `@bluewave/content-schema`, …). In a fresh checkout
   nothing is built, and the preflight gates run in parallel, so this gate loses
   the race and dies with `Failed to resolve entry for package ...`. It fails
   `Quality` (ubuntu) and `Gates (cross-OS)` on Windows; macOS passed only by
   timing.
2. **Windows content-discovery failures.** The `Determinism Gate` runs the full
   suite after build; on `windows-latest` five tests in
   `packages/content-compiler/test/{schemaCoverage,manifestAuthority,shipBuildingDiscovery}.test.ts`
   fail (path-separator / host-order assumptions).

## Out of scope

Any feature change (e.g. the USA roster promotion, PR #6).
