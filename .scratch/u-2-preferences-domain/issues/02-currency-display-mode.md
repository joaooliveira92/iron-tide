# 02: Currency display mode — requested vs effective

**What to build:** The currency-display preference the player asks for, stored
exactly as chosen and never rewritten, alongside a derived effective mode that the
game can show truthfully when the request cannot be honoured — so switching
currency display never changes the campaign and the request is restored later.

**Blocked by:** 01.

**Status:** done

- [x] The schema's `currencyDisplayMode` accepts only `navalCredits`,
      `budgetPoints`, and `nationalHistorical`; the default is `navalCredits`;
      there is no `customCurrency` value and no fallback-status value.
- [x] The domain stores the player's request unchanged and models a separate,
      derived effective mode; with no active campaign the effective mode is
      `navalCredits`.
- [x] A selector exposes requested and effective separately; changing the request
      persists it; an unavailable context never rewrites the stored request.
- [x] A test proves the request survives an unsupported context unchanged and the
      effective mode is derived, not stored.
- [x] Currency availability, reason-code messages, and rendering remain U-3's;
      this ticket only models and stores the request.

## Resolution (U-2 ticket 02)

- The strict schema (ticket 01) already accepts exactly the three modes, defaults
  to `navalCredits`, and rejects `customCurrency`/fallback values
  (`preferencesSchema.test.ts` "has no customCurrency …").
- `preferences-contract.ts` adds the effect-free model: `CurrencyFallbackReason`
  (`noActiveNation`, `nationalCurrencyNotConfigured`, `nationalCurrencyInvalid`,
  `nationalCurrencyOutsideSupportedPeriod`), `NationalCurrencyAvailability` (whose
  `kind` values are exactly the reason codes, plus `configured`),
  `EffectiveCurrencyDisplayMode`, `NO_ACTIVE_NATION_AVAILABILITY`, and the pure
  `resolveEffectiveCurrencyDisplayMode(request, availability)`. Naval Credits and
  Budget Points are always honoured; National Historical resolves to Naval Credits
  with the matching reason when no validated configuration applies. The request is
  never mutated.
- `lib/preferences-context.tsx` adds `useCurrencyDisplayMode(availability =
  noActiveNation)`, exposing `{ requested, effective, fallbackReason?, setRequested }`.
  The request persists through the capability; the effective mode is derived at
  read time and never stored. `availability` is produced by U-3 from the active
  campaign; until then it defaults to "no active nation" (effective = Naval
  Credits). U-3 owns availability computation, the reason-code messages, and the
  rendering.
- Tests: `src/shared/preferences-contract.test.ts` (resolver: defaults,
  always-honoured modes, configured National Historical, each fallback reason, the
  pure request-preservation) and `src/renderer/lib/preferences-context.test.tsx`
  (`useCurrencyDisplayMode`: requested/effective split, persistence, request
  preserved across an unsupported context with no write).
