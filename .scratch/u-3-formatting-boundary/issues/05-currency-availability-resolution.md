# 05: Currency availability and requested→effective resolution

**What to build:** Honest resolution of the player's stored currency request
against the active campaign and the validated national configuration — showing
the effective mode, falling back to Naval Credits with a stated reason code, and
never rewriting the stored request.

**Blocked by:** 02, 04.

**Status:** blocked

- [ ] Availability is computed from the active campaign (its nation and period)
      and the validated national-currency configuration; with no campaign or no
      configuration, the effective mode is `navalCredits`.
- [ ] Each `CurrencyFallbackReason` (`noActiveNation`, `nationalCurrencyNotConfigured`,
      `nationalCurrencyInvalid`, `nationalCurrencyOutsideSupportedPeriod`) maps to
      a localized message, and the UI can state the effective mode truthfully.
- [ ] The stored request is never rewritten by a fallback and is restored when a
      supported campaign is active.
- [ ] Naval Credits is the render and malformed-content fallback and is never
      described as historical.
- [ ] A test drives a supported, an unsupported and a malformed configuration and
      observes the effective mode and reason code; the request is asserted
      unchanged afterward.
