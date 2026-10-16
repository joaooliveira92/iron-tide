# 01: Versioned preferences domain, app-scope persistence, capability and selectors

**What to build:** The end-to-end path a preference takes — strict schema and
central defaults, atomic app-scope persistence, a narrow preload capability, and
typed renderer selectors — proved by migrating the existing Appearance settings
(theme, background, font, interface density) off `localStorage` and onto the
domain, so the game reads and writes them through one validated source and they
survive an app restart.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A main-process preferences model holds a versioned Effect `Schema`, the
      central defaults, a version constant, and the app-scope keys from D4
      (appearance subset plus the shared shape); strict validation rejects an
      unknown key and an out-of-range value with a stable `_tag`.
- [ ] An effect-free shared module holds the preference keys, value unions, scope
      enum, and decoded shape for the renderer; a parity test asserts it equals the
      schema's decoded type.
- [ ] App-scope persistence writes atomically (temp + rename) to one file in the
      app-data directory; a round-trip restores every value; an interrupted write
      leaves the old or the new file, never a partial one.
- [ ] A dedicated `preferences.read` / `preferences.write` preload capability
      decodes every payload with a strict schema at the main boundary, rejects
      excess keys, and returns the decoded preferences; a malformed payload fails
      with a typed `_tag`, never a raw error.
- [ ] Typed renderer selectors read and write through the capability; the theme,
      background, font, and density controls use them, and the `bluewave-theme`,
      `bluewave-background`, `bluewave-font`, and `bluewave-density`
      `localStorage` keys are no longer written.
- [ ] The renderer and preload import no `effect`; the runtime-free and
      boundary-decode gates stay green.
- [ ] A test drives a write then a fresh read through the real composition and
      observes the persisted value.
