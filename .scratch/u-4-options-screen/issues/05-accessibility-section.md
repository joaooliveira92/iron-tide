# 05: Accessibility section — reduced motion, focus, non-colour, tooltip detail

**What to build:** The Accessibility section and the wiring that makes its settings
take effect — a reduced-motion control that actually stops motion, visible keyboard
focus, non-colour status indicators, and a tooltip-detail control — so the
interface adapts to the player's needs.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The stored `reducedMotion` preference (`system` | `reduce` | `noPreference`)
      is consumed through one shared hook and **overrides** the
      `prefers-reduced-motion` media query (`system` defers to it); the animation
      surfaces honour it.
- [ ] A `tooltipDetail` control (`minimal` | `standard` | `detailed`) drives the
      shared tooltip/help surface's verbosity.
- [ ] Visible keyboard focus styling is present on the section's controls, and
      status is conveyed by words/shape as well as colour where the screen shows
      state.
- [ ] The Options screen passes the axe audit (`lib/axe.ts` / `a11y.audit.test.tsx`).
- [ ] A test asserts `reduce` suppresses motion and `system` follows the media
      query, and that `tooltipDetail` changes the tooltip output.
