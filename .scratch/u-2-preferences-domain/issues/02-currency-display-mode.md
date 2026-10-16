# 02: Currency display mode — requested vs effective

**What to build:** The currency-display preference the player asks for, stored
exactly as chosen and never rewritten, alongside a derived effective mode that the
game can show truthfully when the request cannot be honoured — so switching
currency display never changes the campaign and the request is restored later.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The schema's `currencyDisplayMode` accepts only `navalCredits`,
      `budgetPoints`, and `nationalHistorical`; the default is `navalCredits`;
      there is no `customCurrency` value and no fallback-status value.
- [ ] The domain stores the player's request unchanged and models a separate,
      derived effective mode; with no active campaign the effective mode is
      `navalCredits`.
- [ ] A selector exposes requested and effective separately; changing the request
      persists it; an unavailable context never rewrites the stored request.
- [ ] A test proves the request survives an unsupported context unchanged and the
      effective mode is derived, not stored.
- [ ] Currency availability, reason-code messages, and rendering remain U-3's;
      this ticket only models and stores the request.
