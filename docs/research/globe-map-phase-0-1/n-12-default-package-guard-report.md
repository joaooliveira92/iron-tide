# N-12: default-package contamination guard

**Status: passed.** The guard inspects the real unpacked package, distinguishes the default and
spike policies, and is wired into both packaged smokes. Commit `f995399e`. Evidence:
`evidence/n12/` and `evidence/g03a/`.

Labels: **[F]** repository fact, **[M]** measured, **[U]** unverified.

## 1. Why it exists

The G-03 session found that Vite's `public/` handling and electron-builder's file list had
shipped spike tiles, fixtures and the Natural Earth source-archive cache into the **default**
package (fix `92508f73`). A manual listing caught it. N-12 makes the check permanent and
independent of the current directory names.

## 2. Policy model [F]

`apps/desktop/package-policy/package-policy.v1.json` separates seven classes:

1. default production runtime files (no map-spike or map-data asset is allow-listed);
2. spike-only runtime files (the pack, manifest, licences, glyphs and the lazy spike chunks);
3. build-time map-data inputs;
4. generated spike runtime assets;
5. test-only fixtures;
6. investigation evidence and validation output;
7. source archives, extraction caches and bake intermediates.

The policy is manifest-driven, not a filename convention. A mode either has an empty allow-list
(default) or an explicit allow-list with an id, class, reason, path pattern, size cap and
`required` flag (spike). Files in `node_modules` are exempt only from patterns that do not opt
in. Forbidden classes apply to the asar archive, the unpacked directory and the resources beside
the archive. An allow-listed file is still checked against its own cap; a file with no allowance
is checked against `unlistedFileBytesMax`.

## 3. Inspection [F]

`scripts/package-guard/asar.ts` reads the `app.asar` header without executing the app.
`snapshot.ts` walks the archive, the unpacked directory and the resources outside the archive,
reads file bytes, hashes duplicates and scans text files for machine-specific absolute paths.
`guard.ts` applies the policy, verifies the spike manifest/pack SHA-256 and pack size, enforces
the named archive and outside-resource budgets, and sorts violations deterministically by
location, path and rule. `cli.ts` is independently callable:

```
pnpm --filter @bluewave/desktop guard:package --mode default --package <unpacked app>
pnpm --filter @bluewave/desktop guard:package --mode spike --package <unpacked app>
```

`--json <path>` writes the full report. A missing directory, missing `app.asar`, truncated or
non-asar archive, unreadable file or malformed policy exits with an input error; it is never
silently treated as clean.

## 4. Size policy [F/M]

| Mode | `app.asar` budget | Outside archive budget | Unlisted file cap |
|---|---|---|---|
| default | 210,200,000 bytes | 2,100,000 bytes | 1,000,000 bytes |
| spike | 219,200,000 bytes | 2,100,000 bytes | 1,000,000 bytes |

The budgets are named in the policy with a reason. The default budget is a baseline of the
shipped default archive plus a small headroom for build metadata and platform variation; the
spike budget adds the measured pack, glyph and chunk growth. A specific large runtime asset
(the renderer bundle, the production coastline chunk, content artifact, font and production
artwork) has its own named allowance, so an **allowed** large file is governed explicitly and a
**forbidden** small file still fails. Size is never used alone to infer cleanliness.

Measured on 2026-10-27, macOS arm64, after the G-03a pack grew:

| Build | Files | Allowed map assets | Violations | `app.asar` | Outside archive |
|---|---|---|---|---|---|
| Default | 19,514 | 0 | 0 | 206,035,219 bytes | 1,680,333 bytes |
| Spike | 19,534 | 16 | 0 | 214,693,496 bytes | 1,680,333 bytes |

Before G-03a the same guard measured 206,032,016 bytes (default) and 212,906,034 bytes (spike);
the pack growth was 1,554,304 bytes and remained inside the named spike budget.

## 5. Tests [M]

`guard.test.ts`: 29 tests, all passing. Synthetic fixtures and copies are used; no real package
is modified destructively. Coverage:

- clean default package passes; clean spike package passes its distinct policy;
- an expected default runtime asset passes; an expected spike asset passes only in spike mode;
- a generated tile pack and manifest in the default archive fails;
- a source archive beside the archive fails; an extraction cache inside the archive fails;
- a forbidden file outside the archive and in the unpacked directory fails;
- investigation evidence, fixtures, validation output and bake inputs fail;
- a tiny forbidden file fails even when total size is small;
- byte-identical duplicates of a map asset fail;
- raw source archives and caches fail even in spike mode;
- validation output and test inputs inside the spike asset directory fail;
- the spike pack, manifest and glyphs are required; a pack that does not match its manifest
  fails; an allow-listed asset that exceeds its cap fails;
- large unexpected binaries in the archive and beside it fail; archive and outside-resource
  budgets are enforced; Electron framework files are not counted as application resources;
- absolute paths serialised into packaged files and machine-specific files are detected;
- missing package, missing `app.asar`, truncated/non-asar archive and malformed policy fail
  clearly;
- result ordering and rendered output are identical regardless of file insertion order; the
  rendered report never prints the machine-specific package location.

## 6. Integration [F/M]

- `pnpm --filter @bluewave/desktop smoke:packaged` runs the default policy first and reports
  `the package holds no globe-spike, map-data or investigation assets`; it passed 23/23.
- `node scripts/globe-spike-smoke.mjs` runs the spike policy first and reports
  `the spike package holds only the allow-listed spike assets`; it passed 27/29 with the
  unchanged N-09 findings.
- The spike package under the **default** policy fails on 11 exact paths (manifest, licences,
  tile pack, code chunk and related assets), which proves the default policy is not permissive
  by omission.
- `package-policy/**` and `scripts/package-guard/**` are excluded from the package and are
  themselves forbidden by the policy.

## 7. First real run: additional leaks found [M]

The first run found more than the spike: `test-results` screenshots, `*.tsbuildinfo`, compiled
tests containing fixture home paths, and the spike's `validation.json` and
`protected-resolution.json`. They were excluded from packaging and the guard now rejects them.
This is why the policy covers evidence, validation output and build metadata, not only tiles.

## 8. Limitations

- The guard inspects the unpacked, unsigned local package layout. Signed/notarized artifacts and
  Windows/Linux layouts are not exercised here; N-05 remains blocked-external.
- The size budgets are baselines plus headroom, not exact byte assertions; a deliberate large
  change must update the named budget and its reason.
- Node modules that are not application resources are not fully scanned for content, only for
  the patterns that opt in.
- The guard cannot prove the absence of a file that the packager never wrote; it proves the
  absence of every policy class in the artifacts that were actually produced.
