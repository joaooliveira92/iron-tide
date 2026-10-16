# 01: Options screen shell, sections, reachability, preview and reset

**What to build:** The Options screen itself — one settings screen with the seven
sections, reachable from the main menu before a campaign and from inside one, where
every control writes the preferences domain with immediate live preview and can be
reset per section or all — so a player can configure the game in one place, at any
time.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The `options` screen presents the seven ADR-0203 sections (General,
      Appearance, Measurements, Currency and Numbers, Gameplay Interface,
      Accessibility, Advanced), navigable within the screen.
- [ ] The screen is reachable **before a campaign** (a new main-menu / pre-campaign
      entry point opening the same screen) and **inside a campaign** (the existing
      settings-group route); both paths render the same controls.
- [ ] Every control reads and writes through the U-2 preferences domain
      (`usePreferences`); changes preview immediately and persist; no control writes
      `localStorage`.
- [ ] A reset-per-section and a reset-all restore the central defaults
      (`DEFAULT_APP_PREFERENCES`) through the same write path.
- [ ] A test mounts the screen over the preferences bridge stub and asserts a
      control writes the expected preference, the preview applies, the reset
      restores the default, and legacy `localStorage` keys are not written.
- [ ] The screen works with no active campaign; the shell no longer gates it.
