# ADR-0221: Structured explanation data for domain display values

## Status

Accepted (2026-10-16). Completes the display-formatting sweep that ADR-0218
assigns to U-3 (`.ai/SPRINT-PLAN.md` Phase 2, ticket 06): the last deterministic
`toFixed` display formatting leaves `packages/ship-design/src` and
`packages/phase-engine/src`, and no authoritative package formats a number for
display.

## Context

ADR-0218 fixed that canonical↔display conversion happens only at the
presentation boundary and that no authoritative package owns presentation text.
U-3 removed the locale-dependent `toLocaleString`/`Intl` calls from the domain
(deterministic `numberText.ts`), and a source guard
(`packages/ship-design/test/presentation-leak.test.ts`) bans locale formatting
outright and ratchets the remaining deterministic `.toFixed()` sites. Those
sites still build a display number and its unit suffix inside the domain:
`packages/ship-design/src/{hull,machinery,rebuild,refit,report,suggest,workshop}.ts`
and `packages/phase-engine/src/reviseProject.ts`.

A domain number must reach the screen unchanged in meaning but formatted by the
presentation home (U-3's `renderer/lib/presentation-format/`). The finding,
metric, report and description text that carries those numbers is consumed in
several places: the renderer components, the main-process command diagnostics
(the frozen `CommandRejected.diagnostics` string channel), and the
`RebuildFindingView` the main process hands to the renderer.

## Decision

The domain emits **structured explanation data**: an explanation is ordered
literal text plus display-value tokens, and the presentation boundary renders
it. No domain package calls `toFixed`/`Intl`/`toLocaleString` or divides a
canonical value for display.

- **Shape.** `packages/ship-design/src/explanation.ts` defines
  `ExplanationText = string | readonly ExplanationPart[]`, where an
  `ExplanationPart` is a literal `string` or an `ExplanationValue`
  `{ value, scale, fractionDigits, unit }`. `value` is the canonical integer
  (basis points, milli-knots, millimetres, micrometres, or a plain x100/x1000
  ratio); `scale` is the canonical→display divisor the boundary applies;
  `fractionDigits` is the rendered precision; and `unit` is a **stable unit
  code** (`ratio`, `percent`, `percentSpaced`, `percentOfLimit`, `trimPercent`,
  `knots`, `metres`, `inches`) the boundary maps to its symbol. The domain keeps
  the surrounding prose as literal parts, so existing wording is preserved
  verbatim.
- **Fields.** `Finding.what`/`why`/`consequence`, `Remedy.description`,
  `WorkshopView` metric values, and `SuggestedFix.description` become
  `ExplanationText`. A plain string remains valid, so unrelated rules need no
  change; only the number-bearing texts are structured.
- **Renderer.** The explanation renderer is
  `apps/desktop/src/shared/explanation-text.ts` (effect-free; imports only the
  `ExplanationText` type): `formatExplanation(text, locale = "en-US")` joins the
  parts and renders each token as its canonical fixed decimal with the unit
  code's symbol. It is re-exported from the single presentation home
  (`renderer/lib/presentation-format/`) for components. It lives in `shared/`
  because the main process also renders explanations for
  `CommandRejected.diagnostics` and the rebuild view, and the frozen diagnostic
  channel carries strings. Locale-aware number and measurement rendering over
  these tokens is a later migration (U-3 map D5 / U-4); the fixed-decimal
  rendering is byte-identical to the former domain `toFixed` output.
- **Main process.** The main process renders domain findings it must turn into
  diagnostic strings (or the rebuild view) with the same shared renderer at
  `en-US`; the renderer renders for display with the user's formatting locale.
- **Phase-engine diagnostics.** A diagnostic message is a plain string on the
  frozen `DiagnosticCollector` channel, so the engine emits stable codes and
  parameters, not a formatted percentage; the number is formatted where it is
  shown.
- **Gate.** The ratchet in `presentation-leak.test.ts` shrinks to empty as the
  sites are removed and can never grow; the locale ban stays.

## Consequences

- No authoritative package performs display formatting or display-unit
  conversion; `toFixed` no longer appears in `packages/ship-design/src` or
  `packages/phase-engine/src`.
- Rendered explanation strings are byte-identical for the default locale, so
  existing UX and the exact-string tests are unchanged; a locale change now
  moves only presentation.
- The explanation renderer is shared between the main and renderer projects; it
  is part of the presentation boundary, not a second formatter, and no domain or
  authoritative package may import it.
- Changing an explanation's shape is a presentation change, not a wire-format or
  compatibility change; no golden hash moves.
