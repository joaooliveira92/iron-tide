# ADR-0203: Options screen and preferences architecture

Applies to: desktop, persistence

## Status

Accepted (2026-10-15). New record of decision DR-003; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

An `OptionsScreen.tsx` stub exists with theme, density, and font contexts but no
preferences domain, validation, migration, or persistence. Presentation preferences
must be versioned, validated, and stored outside authoritative simulation state.

## Decision

Preferences get a versioned schema with central defaults, strict validation,
deterministic migration, atomic main-process persistence, a narrow preload capability,
and typed selectors, scoped to app, campaign, and session. Settings include
`language`, `formattingLocale`, `theme`, `textScale`, `interfaceDensity`,
`measurementPreset`, per-category custom measurement selections, `currencyDisplayMode`,
`numberScale`, `reducedMotion`, and `tooltipDetail`. Corrupt or unknown settings recover
without touching saves.

## Consequences

- The preferences domain (U-2), formatting boundary (U-3), and Options screen (U-4)
  implement this architecture in order.
- Requested and effective currency-display modes are modelled separately; fallback is
  runtime state and never rewrites the stored request (ADR-0211).
