# D3: Theme model and the high-contrast theme

**Type:** grilling · **Status:** resolved

## Question

What themes does U-4 offer, and what does "themes on every released screen" mean?

## Answer

Add **`highContrast`** to the theme preference, which U-2 deliberately deferred to
U-4 (the contract's comment and schema currently reject it). The theme set becomes
`system`, `light`, `dark`, `highContrast`; `system` still resolves through
`prefers-color-scheme`. The control shows all four.

`highContrast` is implemented with the existing token architecture: a token set
(CSS variables) that meets contrast requirements on every released screen, applied
through the same `documentElement` mechanism the light/dark themes use. "Themes on
every released screen" means each registered production screen and the pre-campaign
views are verified to consume the semantic tokens (no hard-coded colours that break
under high contrast); the debug/dev screens are exempt (as the type-floor guard
already exempts them).

The contract/schema change (adding `highContrast`) is a preference-value change, not
a save/wire change; it is versioned through the U-2 schema and moves no authoritative
hash.

## Why

ADR-0203 lists theme `system/light/dark/high-contrast` and the sprint row requires
"themes system/light/dark/high-contrast on every released screen"; the U-2 contract
comment explicitly reserves `highContrast` for U-4. Reusing the token system keeps
one theming mechanism and makes the sweep a verification of token usage rather than
a per-screen rewrite.
