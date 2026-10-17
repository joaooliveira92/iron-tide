# D5: Currency and Numbers control semantics

**Type:** grilling · **Status:** resolved

## Question

What does the currency control show and do, given U-3 owns availability and
resolution?

## Answer

The control presents the three modes — **Naval Credits** (default), **Budget
Points**, **National Historical** — each with the ADR-0206/0207/0211 description,
using U-3's `resolveEffectiveCurrencyDisplayMode` / reason codes and U-2's
`useCurrencyDisplayMode` selector. It:

- defaults to Naval Credits on a fresh profile;
- **disables or hides National Historical when it is unavailable, with a stated
  reason** ("no campaign" or "nation unsupported") — never silently;
- **shows the effective mode truthfully** and never describes Naval Credits as
  historical;
- **updates when the active campaign changes** (opening/closing a campaign changes
  availability and the effective mode), while preserving the stored request.

The control never renders a formatted amount itself — it sets the request and
displays the effective mode; the amount rendering is U-3's `formatMoney`.

## Why

ADR-0211 requires the unavailable mode to be disabled/hidden with a stated reason
and the effective mode shown truthfully; ADR-0208 forbids a custom currency; the
U-2 acceptance requires the control to update on campaign change. Delegating
availability and formatting to U-3/U-2 keeps U-4 a control surface, not a second
source of currency truth.
