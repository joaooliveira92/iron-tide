# 07: Themes and accessibility on every released screen

**What to build:** The guarantee that every shipped screen honours the theme
(including high contrast) and the accessibility settings — not just the Options
screen — so the player's choices are consistent across the game.

**Blocked by:** 02, 05.

**Status:** blocked

- [ ] Every registered production screen and every pre-campaign view is verified to
      consume the semantic theme tokens (no hard-coded colours that break under
      `highContrast` or dark); any offender is fixed.
- [ ] The high-contrast token set is applied app-wide through the same mechanism as
      light/dark.
- [ ] The accessibility audit covers the released screens; keyboard focus and
      non-colour indicators hold.
- [ ] A test or gate asserts no released screen carries a hard-coded colour literal
      that bypasses the tokens (the debug/dev screens remain exempt).
