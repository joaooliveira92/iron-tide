# Map: U-5 Presentation invariance

**Label:** wayfinder:map · **Status:** charted; the route is clear — the acceptance
criteria `.ai/SPRINT-PLAN.md:107` are explicit, so no decision ticket remains before
slicing. U-5 is **golden-neutral and ungated**.

## Destination

The evidence that presentation is not gameplay: a **standing invariance suite** that,
under every currency mode, measurement preset, number scale, locale, theme and
density, observes the compiled campaign snapshot, the save, the canonical money and
the cross-process reference run **unchanged** — plus the bounded wiring and gates
needed to make that invariance observable and enforced. No new preference setting,
formatter, or per-nation currency content is added.

U-2 built the domain, U-3 the boundary, U-4 the screen; each named this suite as
the U-5 seam (`.ai/reports/u-2-preferences-domain.md:67-68`,
`.ai/reports/u-4-options-screen.md:20,59-60`).

## Notes

- Authority order per ADR-0210. ADR-0202 (presentation-only), ADR-0203 (preferences
  architecture), ADR-0209 (language/locale), ADR-0206/0207/0208/0211 (currency modes),
  ADR-0215–0219 (canonical values, money bridge, rounding/float gate, boundary). The
  manual grounds only units/save/realism options; the rest is Bluewave presentation
  design.
- The recon gap analysis (orchestrator-run `explore`) classified the 16 acceptance
  clauses: **existing** 2, 3, 5, 8, 9, 13; **partial** 1, 4, 6, 7, 10, 11, 12, 14, 16;
  **missing** 15. U-5 closes the partial/missing ones; the existing ones are
  re-asserted by the standing suite rather than rebuilt.
- **Stop surface (D3):** if any invariance test shows a preference *can* move an
  authoritative hash, stop — that is an ADR-0202 violation to raise, not to paper
  over with a re-pin.
- The route is clear and no decision changes gameplay, so U-5 raises **no decision
  request**. The manual-silent National-Historical per-nation *content* remains U-3's
  owner decision and is out of scope.

## Decisions so far

- **D1 Scope boundary.** U-5 owns the standing cross-mode/cross-preset invariance
  suite and the minimal wiring/gates it needs: live currency availability from the
  active campaign (so request preservation/restoration is observable), the missing
  dev warning for untranslated settings strings, the packaged/boundary persistence
  proof, the storage rule in the presentation gate, and the register/baseline
  assertions. It does **not** add settings, formatters, per-nation currency content,
  save/autosave changes (F-4) or tactical preferences (T-2).
- **D2 One seam.** Drive the real production composition — the cross-process child
  and the main-process preferences composition over a temporary app-data directory —
  applying preferences by configuration and observing authoritative hashes. No new
  test seam; the highest existing seam is reused.
- **D3 Gating and authority.** U-5 is golden-neutral: it stores presentation
  preferences outside the snapshot and proves the reference run unchanged. No golden
  re-pin, no compatibility bump, no new decision request. Stop if a preference is
  shown to move an authoritative value or hash.
- **D4 Live availability.** Wire `computeNationalCurrencyAvailability` to the active
  campaign's nation in the renderer resolution, so the effective mode (and its reason
  code) is derived from real state; no national configuration is fabricated, so a
  nation with no valid configuration still falls back to Naval Credits with a stated
  reason. The stored request is never rewritten.
- **D5 Boundary persistence.** Prove a preference write round-trips through the real
  main-process IPC handler + preload capability decode and is re-read after a fresh
  composition, rather than only through a renderer stub; extend the packaged smoke if
  it is cheap and stable.
- **D6 Storage gate.** Extend the presentation-formatting gate to bar direct
  `localStorage`/`sessionStorage` in the settings/formatting surfaces (baselined as a
  ratchet, not a flag day), so preferences cannot grow a second store.
- **D7 Register and baseline.** Assert, as a test, that the unavailable-artifact
  register stays complete and that `golden/hashes.json` carries the new-baseline
  classification (ADR-0210), so clauses 6 and 7 are checked, not merely documented.

## Not yet specified

- Whether the storage rule is a new script or an extension of
  `assert-presentation-formatting.mjs` — settled at implementation.
- The exact "new baseline" marker representation in `golden/hashes.json` — settled at
  implementation against `docs/agents/golden-repinning.md`.

## Out of scope

- New preference settings, new formatters/parsers, National-Historical per-nation
  content (U-3, owner decision), the Options screen (U-4), save slots/autosave (F-4),
  tactical preferences (T-2), Playwright E2E expansion beyond a packaged preference
  check.
