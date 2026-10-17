# 04: Currency and Numbers section — honest currency control

**What to build:** The currency-display control that offers Naval Credits, Budget
Points and National Historical with clear descriptions, disables or hides National
Historical with a stated reason when it is unavailable, and always shows the
effective mode truthfully — so the player is never misled about their currency.

**Blocked by:** 01.

**Status:** done

- [x] The control lists `navalCredits` (default), `budgetPoints` and
      `nationalHistorical` with the ADR-0206/0207/0211 descriptions; there is no
      custom-currency option.
- [x] It uses U-3's availability/resolution and the U-2 `useCurrencyDisplayMode`
      selector; National Historical is **disabled or hidden with a stated reason**
      ("no campaign" or "nation unsupported") when unavailable.
- [x] The effective mode is shown truthfully; Naval Credits is never described as
      historical; the stored request is preserved and restored.
- [x] The control updates when the active campaign changes (open/close) and never
      renders a formatted amount itself.
- [x] A test drives a supported, an unavailable and a no-campaign state and
      observes the effective mode, the reason, and the preserved request.
- [x] Externally depends on U-3 (availability/resolution) — recorded, not a sibling
      blocker.
