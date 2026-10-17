# D2: Home and shape of the presentation conversion module

**Type:** grilling · **Status:** resolved

## Question

Where does the single presentation conversion/formatting module live, and how is
it shaped so the renderer stays runtime-free and the domain stays presentation-free?

## Answer

One **effect-free presentation formatting module** on the renderer side, under the
existing `apps/desktop/src/renderer/lib/` presentation area — the home ADR-0218
deferred. It:

- imports only the runtime-free `@bluewave/contracts` (canonical unit table,
  `Money`/branded types, `BP_ONE`, `RoundingMode`) and the shared, effect-free
  preferences contract for value unions; it imports no `effect`, no
  `@bluewave/content-schema`, no Node, and no authoritative engine package;
- exposes pure functions — `formatMoney`, `formatMeasurement`, `formatPercent`,
  `formatNumber`, `formatMonth`, and their inverse parsers — that take the value,
  the display preference(s), and an explicit locale as arguments;
- reads the display-unit taxonomy and per-category selections from the
  preferences domain (U-2), never from a hard-coded map at a call site;
- is the **only** module allowed to call `Intl`/`toLocaleString`/`toFixed` or to
  convert canonical→display units, enforced by the D6 gate.

Compile-time authoring→canonical conversion stays in the content compiler
(ADR-0218); main and persistence do no display formatting. No new package: the
module is app-local, matching the existing renderer `lib/` (and ADR-0218's
"renderer side" wording), and avoids a speculative package.

## Why

The renderer must import no `effect` and no authoritative packages (runtime-free
gate, ADR-0159; `content-boundary.test.ts`), and it may import
`@bluewave/contracts`. A single pure module with explicit arguments is directly
unit-testable under `vite-plus/test` without Electron and makes the ADR-0218
boundary real: exactly one home for canonical↔display conversion, and a source
guard that keeps every other module out of it.
