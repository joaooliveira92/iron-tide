# D6: Boundary and locale separation

**Type:** grilling · **Status:** resolved

## Question

Where may canonical↔display conversion happen, and how are UI language and
formatting locale separated?

## Answer

- **Canonical values carry no locale.** Stored and authoritative state is
  locale-free by construction (ADR-0202/ADR-0209); no formatted text is persisted
  (already enforced by the save boundary).
- **Two distinct concepts, two settings.** *UI language* (the string catalog;
  English with a complete en-US fallback, ADR-0209) and *formatting locale* (how
  numbers, dates and measurements are rendered) are separate preferences and never
  derived from one another (ADR-0209). U-1 fixes the split; U-2 stores it; U-3
  implements it.
- **Conversion only at the presentation boundary.** A single presentation
  conversion module (renderer side; exact home deferred to U-2/U-3, map "Not yet
  specified") converts canonical → display units and money. Authoritative packages
  and persistence perform **no** display formatting and **no** display-unit
  conversion. Compile-time authoring→canonical conversion is the one other
  sanctioned conversion, and it lives in the content compiler.
- **The domain-package leak is removed.** `packages/campaign-engine/src/priorities.ts`
  builds human-readable strings with `toLocaleString()`; it is not wired into
  `MonthExecutor`, but it is a domain package formatting for display. U-1 removes
  or relocates that formatting so no authoritative package owns presentation text.
- **No ad-hoc conversion.** `umsToKnots`/`umToMm` and any display conversion move
  behind the single module; a lint/gate bars ad hoc unit or locale conversion and
  ad hoc `Intl`/`toLocaleString`/`toFixed` in components (extends the U-3/U-5
  lint intent).

## Why

The recon found mixed locales (`en-US`/`en-GB`), hardcoded `£`, and conversion
scattered across call sites, plus one leak inside a domain package. Fixing the
boundary and the language/locale split now means U-3 has one place to implement
formatters and U-5 can prove invariance, instead of retrofitting a boundary later.

## Gating

Per-call-site formatter clean-up in the renderer is value-preserving (renderer
never touches authority) and can start now. The `priorities.ts` change is
value-preserving unless it alters a hashed projection string; if it does, it is
gated by 0005 (D7).
