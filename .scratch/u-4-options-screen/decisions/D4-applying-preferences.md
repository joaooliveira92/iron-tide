# D4: Applying accessibility and display preferences

**Type:** grilling · **Status:** resolved

## Question

How do the stored display and accessibility preferences actually take effect in the
UI?

## Answer

U-4 wires the stored values into the rendered interface, using the domain's
existing provider/preview mechanism:

- **`textScale`** (integer percent, 85–130) is applied once at the shell root (a
  root font-size / scale token), so every screen scales with it; no per-component
  text sizing.
- **`reducedMotion`** (`system` | `reduce` | `noPreference`) is consumed by the
  animation surfaces. Today they read `prefers-reduced-motion` directly; U-4 makes
  the stored preference authoritative over the media query (`system` defers to the
  media query) through one shared hook, so the toggle has effect.
- **`interfaceDensity`** and the **Appearance** values (theme, background, font)
  are already applied through their providers; U-4 surfaces their controls.
- **`tooltipDetail`** (`minimal` | `standard` | `detailed`) drives the shared
  tooltip/help surface's verbosity.
- **Keyboard focus and non-colour indicators** are provided: visible focus styling
  on every control, and status conveyed by words/shape as well as colour (the
  existing `StatusStrip`/`map-a11y` non-colour patterns are the precedent), audited
  by axe.

All of it is presentation-only: no authoritative value is read or written.

## Why

The U-2 contract stores `textScale`, `reducedMotion` and `tooltipDetail`, but
nothing consumes them today (grep shows contract/schema/tests only), and the sprint
row requires "text size, density, reduced motion, tooltip detail, keyboard focus,
non-colour indicators". One root application point keeps scaling and motion
consistent and testable.
