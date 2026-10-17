# Spec: U-5 Presentation invariance

**Status:** done (sliced into `issues/`; accepted in
`.ai/reports/u-5-presentation-invariance.md`) · **Map:** `map.md` · **Decisions:**
`map.md` D1–D7 ·
**Authority:** ADR-0202 (presentation-only), ADR-0203 (preferences architecture),
ADR-0209 (language/locale), ADR-0206/0207/0208/0211 (currency modes),
ADR-0210 (authority order + unavailable artifacts), ADR-0215–0219 (canonical values,
money bridge, rounding/float gate, boundary) · **Gating:** none — U-5 is
golden-neutral and ungated (map D3).

## Problem Statement

The whole point of the presentation layer — U-2 preferences, U-3 formatters, U-4
Options — is that it is **not gameplay**: no theme, unit, currency, language, locale,
density or scale may change what happens in a campaign (ADR-0202). Today that claim
rests on a **structural argument** rather than an observable one. The only invariance
test (`apps/desktop/src/main/preferences/preferencesInvariance.test.ts`) asserts that
the preferences domain imports no `@bluewave/*` package and that the golden *file
bytes* are unchanged after decoding every preference value. It never drives a
campaign, never formats money, and never crosses the Electron boundary. A future
change could make a preference authoritative and these tests would still pass.

Several acceptance clauses are consequently unproven or unenforced:

- no test runs the compiled campaign / save / cross-process reference under each
  currency mode and unit preset and observes identical authoritative hashes and
  canonical money (clauses 1, 10, 11);
- currency availability is **never computed from the live campaign** — the Options
  screen always resolves against `NO_ACTIVE_NATION_AVAILABILITY`
  (`OptionsScreen.tsx:150`), so "requested mode preserved across unsupported
  campaigns and restored in supported ones" is not actually exercised (clause 4);
- the settings string catalogue (`renderer/lib/strings.ts`) has **no dev warning** for
  a missing translation (clause 12) — only the content-message catalogue does;
- nothing proves a preference write survives the **real Electron/IPC boundary** and a
  fresh composition; E2E writes the preferences file directly (clause 15);
- the presentation gate bars ad-hoc `Intl`/`toLocaleString`/`toFixed`/currency symbols
  but **not** ad-hoc `localStorage`/`sessionStorage`, so a second preference store
  can reappear unchallenged (clause 16);
- the unavailable-artifact register and the "new golden baseline" classification
  (ADR-0210) are documented but **not checked by any test** (clauses 6, 7).

## Solution

Build the **standing presentation-invariance suite** and the bounded wiring and gates
that make it real, without adding a preference, a formatter, or per-nation content.

1. A cross-mode/cross-preset invariance test drives the real production composition
   with every preference applied and asserts the compiled campaign snapshot, the
   save, and the canonical money are byte-identical, and that no formatted money
   string appears in the save.
2. The renderer resolves currency availability from the **active campaign's nation**
   (no fabricated configuration), so the effective mode and its reason code are
   derived from live state, the stored request is preserved across unsupported
   contexts and restored when a configuration applies, and the fallback is never
   silent.
3. The settings catalogue warns in dev when a key is missing and never renders a raw
   key; a test pins both.
4. A main-process test round-trips a preference write through the real IPC handler and
   preload-capability decode and re-reads it after a fresh composition; the packaged
   smoke asserts a preference persists if it is cheap and stable.
5. The presentation gate gains a storage rule (direct `localStorage`/`sessionStorage`
   in settings/formatting surfaces) as a baselined ratchet.
6. Tests assert the unavailable-artifact register stays complete and
   `golden/hashes.json` is classified as the new baseline.

Nothing about gameplay changes: every clause is a display preference over canonical
values; U-5 moves no authoritative hash and needs no compatibility bump.

## User Stories

1. As an auditor, I want a test that runs the compiled campaign under **every**
   currency mode and unit preset and sees the same authoritative hash, so that
   "presentation is not gameplay" is evidence, not an assertion.
2. As an auditor, I want the save to be proven free of formatted money, so that a
   currency-mode change can never corrupt authoritative state.
3. As a player, I want my currency-display request remembered when my nation cannot
   honour it and restored when it can, so that my choice is never silently lost.
4. As a player, I want the game to show the effective currency mode and its reason
   truthfully from my actual campaign, so that I am never misled.
5. As an engine developer, I want the availability resolution wired to the active
   campaign, so that the request/effective split is exercised end to end.
6. As a player, I want a missing translation to fall back to en-US with a developer
   warning and never a raw key, so that the UI is never broken.
7. As an engine developer, I want a test proving a preference survives the real
   main/preload boundary and a restart, so that persistence is not just a stub.
8. As an engine developer, I want the presentation gate to bar ad-hoc
   `localStorage`, so that preferences cannot grow a second store.
9. As an ARB owner, I want the unavailable-artifact register and the new-baseline
   status checked by a test, so that the authority index cannot silently rot.
10. As an engine developer, I want deterministic, idempotent migration from the
    version-0 state re-asserted by the standing suite, so that upgrades stay reliable.
11. As an engine developer, I want the existing per-clause proofs (default NC, reason
    codes, corrupt recovery, locale/language split, fallback to NC) consolidated into
    the standing suite, so that one run covers the whole sprint.
12. As a release engineer, I want U-5 to land with no golden re-pin and no
    compatibility bump, so that it ships independently.
13. As a release engineer, I want the full gate green on the exact commit, so that
    acceptance is evidence.

## Implementation Decisions

- **Scope (map D1).** U-5 owns the standing suite + the minimal wiring/gates listed
  above. It adds no setting, formatter, per-nation currency content, save/autosave
  change (F-4) or tactical preference (T-2). The manual-silent per-nation
  National-Historical content stays U-3's owner decision.
- **One seam (map D2).** Drive the real composition: the cross-process child
  (`packages/cross-process-test/src/run-child.ts`) and the main-process preferences
  composition over a temporary app-data directory. Preferences are applied by
  writing the app-scope file / configuring the renderer bridge, then hashing the
  compiled snapshot and the save. No new test seam.
- **Availability wiring (map D4).** `computeNationalCurrencyAvailability` (U-3) is
  driven from the active campaign's nation in the renderer resolution; a nation with
  no validated configuration yields a reason code and a Naval Credits fallback; the
  stored request is never rewritten. No configuration is fabricated.
- **Strings (map D1).** The settings catalogue (`renderer/lib/strings.ts`) gains the
  same dev-only missing-key warner the content catalogue has
  (`renderer/content/uiCatalogue.ts:26-30`), overridable for tests; production still
  returns the en-US fallback (never a raw key).
- **Boundary persistence (map D5).** A main-process test builds the real preferences
  IPC handler over a temp directory, writes through the preload-capability decode,
  and re-reads through a fresh instance. Packaged smoke is extended only if cheap and
  stable; Playwright expansion is out of scope.
- **Storage gate (map D6).** Extend the presentation-formatting gate to flag direct
  `localStorage`/`sessionStorage` in the settings/formatting/Options surfaces,
  baselined as a ratchet against the existing allowed uses.
- **Register + baseline (map D7).** A test parses the unavailable-artifact register
  and asserts every entry is classified, and asserts `golden/hashes.json` carries
  the ADR-0210 new-baseline classification.
- **Gating (map D3).** Golden-neutral, ungated, no new decision request; stop if a
  preference is shown to move an authoritative value or hash.

## Testing Decisions

- **One seam.** The invariance suite drives the real cross-process/main composition;
  the domain and formatter unit tests it consolidates are fixtures, not mocks.
- A good test sets up through production composition, replaces only true external
  boundaries (the app-data directory, the OS reduced-motion signal, the IPC
  transport), and asserts observable behaviour: the authoritative hash, the save
  contents, the decoded preference value, the typed error `_tag`, the rendered
  fallback. It never asserts internals or paths that go stale.
- **Cover:**
  - **Cross-mode/preset invariance:** the compiled campaign snapshot hash and the
    cross-process reference hash are identical under all three currency modes, both
    measurement presets, every number scale, theme, density, language and locale;
    the save is byte-identical; no formatted money or currency reason code appears in
    the save. (clauses 1, 10, 11)
  - **Availability and request preservation:** no campaign → `noActiveNation`; a
    nation without a valid configuration → `nationalCurrencyNotConfigured` / invalid;
    a configured nation → `configured`; the stored request is unchanged across an
    unsupported→supported transition and restored. (clauses 3, 4, 5, 9)
  - **Fallback and defaults:** fresh profile defaults to NC; NC/BP honoured
    unconditionally; national-currency fallback to NC with a reason. (clauses 2, 3, 9)
  - **Migration and recovery:** version-0 state migrates deterministically and
    idempotently; a corrupt file and an unknown value recover to defaults with a
    diagnostic and leave the save directory byte-identical. (clauses 13, 14)
  - **Strings:** a missing key falls back to en-US, warns in dev, and never renders
    the raw key. (clause 12)
  - **Boundary persistence:** a write through the real IPC handler + preload decode
    is re-read after a fresh composition; a malformed payload is rejected with a
    stable `_tag`. (clause 15)
  - **Storage gate:** a component that reads `localStorage` directly fails the gate
    unless baselined; the preferences consumers pass. (clause 16)
  - **Register and baseline:** the unavailable-artifact register is complete and
    classified; the golden hashes carry the new-baseline classification. (clauses 6, 7)
- **Prior art:** `preferencesInvariance.test.ts`, `preferencesMigration.test.ts`,
  `preferencesStore.test.ts`, `preferencesBridge.test.ts`,
  `currency-availability.test.ts`, `preferences-contract.test.ts`, `strings.test.ts`,
  `uiCatalogue.test.ts`, and the cross-process package.

### Acceptance criteria traceability

| # | Acceptance clause (U-5) | Requirement IDs | Proving test / gate |
| --- | --- | --- | --- |
| 1 | Same campaign hashes & canonical money under every mode/preset | BW-PRS-001/004, BW-ARC-002; ADR-0202 | cross-mode/preset invariance test |
| 2 | Fresh-profile default is NC | BW-PRS-003; ADR-0206 | contract/schema test |
| 3 | NH availability by nation / none / missing / invalid | BW-PRS-003; ADR-0211 | currency-availability test |
| 4 | Request preserved/restored across campaigns | BW-PRS-003; ADR-0211 | availability wiring test |
| 5 | No silent UI fallback | BW-PRS-004; ADR-0211 | Options/availability test |
| 6 | Unavailable-artifact classification checked | BW-DOC-001; ADR-0210 | register test |
| 7 | First golden hashes flagged as a new baseline | BW-DOC-001; ADR-0210 | golden-baseline test |
| 8 | Locale independent of language | BW-PRS-002; ADR-0209 | contract/strings test |
| 9 | National-currency fallback to NC | BW-PRS-003; ADR-0211 | availability/money test |
| 10 | No float drift | BW-VAL-001; ADR-0216/0217 | invariance test + float gate |
| 11 | No formatted money in saves | BW-PER-002; ADR-0202 | save-contents assertion |
| 12 | Missing-translation fallback + dev warning, no raw keys | BW-PRS-004; ADR-0209 | strings test |
| 13 | Corrupt-settings recovery | BW-PRS-002; ADR-0203 | store/migration test |
| 14 | Migration from earlier schemas | BW-PRS-002; ADR-0203 | migration test |
| 15 | Packaged persistence through the Electron boundary | BW-ARC-001; ADR-0203/0159 | boundary persistence test |
| 16 | Lint gate bars ad hoc conversion/storage/date formatting | BW-STA-001; ADR-0002 | presentation-formatting gate + storage rule |

### Definition of done (reviewer checklist)

- [ ] The cross-mode/cross-preset invariance test drives the real composition and
      proves an unchanged campaign snapshot, save and canonical money, with no
      formatted money in the save.
- [ ] Availability is resolved from the active campaign; the request is preserved
      across unsupported contexts and restored when a configuration applies; no
      silent fallback.
- [ ] The settings catalogue warns in dev on a missing key and never renders a raw
      key.
- [ ] A preference write round-trips through the real main/preload boundary and is
      re-read after a fresh composition.
- [ ] The presentation gate bars ad-hoc `localStorage`/`sessionStorage` in the
      settings/formatting surfaces as a baselined ratchet.
- [ ] The unavailable-artifact register and the new-baseline classification are
      covered by tests.
- [ ] Migration and corrupt recovery are deterministic, idempotent, and leave saves
      untouched.
- [ ] No authoritative value, no save/wire format, and no golden hash changes.
- [ ] All sixteen acceptance clauses trace to the named tests/gates above.
- [ ] Focused and full gates are green on the exact commit; clean tree; Conventional
      Commit subjects.

## Out of Scope

- New preference settings, new formatters/parsers, per-category unit taxonomy
  (U-3/U-4), National-Historical per-nation content (U-3, owner decision).
- The Options screen itself (U-4); save slots, copy, autosave (F-4); tactical
  preferences (T-2).
- Playwright E2E expansion beyond an optional packaged preference check; a stored
  schema version beyond 1.
- Any new package, dependency, or ADR beyond those already accepted.

## Further Notes

- **Gating.** U-5 is golden-neutral and ungated: it stores presentation preferences
  outside the snapshot and moves no authoritative outcome; no golden re-pin, no
  compatibility bump, no open decision request. **Stop surface:** a preference shown
  to move an authoritative value or hash is an ADR-0202 violation to raise.
- **Requirement traceability.** `.ai/REQUIREMENTS.md` holds the stable IDs used above.
- **Validation.** Focused: the desktop preferences/formatting/strings/Options tests,
  the cross-process package, and `pnpm preflight`. Full orchestrator gate: clean
  uncached build (`vp run -r build --no-cache`), `tsc -b`, `pnpm lint`, `pnpm format`,
  the full test suite, the cross-process child run twice (byte-identical),
  `node scripts/verify-golden-hashes.cjs`, then `pnpm preflight`, `pnpm test:scripts`
  and `pnpm check`.
- **Compatibility.** U-5 changes no save/wire format and no compatibility version.
- **Risk.** U-5 is not accepted until the invariance suite drives the real
  composition, availability is wired, the boundary persistence is proven, and the
  gates are green.
