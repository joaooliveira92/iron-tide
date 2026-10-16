# 02: Appearance section — theme, high contrast, text size, density, background, font

**What to build:** The Appearance section, including the high-contrast theme and a
text-size control that actually scales the interface, so a player can set the look,
contrast and readability of the whole game and every screen honours it.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `highContrast` is added to the theme preference (the value U-2 deferred to
      U-4), validated by the one preferences schema, and offered alongside
      `system`/`light`/`dark`.
- [ ] Selecting a theme applies it through the existing token mechanism (the shell
      root); the high-contrast token set meets contrast requirements.
- [ ] `textScale` (bounded integer percent) is applied once at the shell root so
      the whole interface scales; changing it previews immediately.
- [ ] Background, font and interface density controls are present and driven by the
      domain (migrating the existing three-control screen fully).
- [ ] A test asserts each theme applies, a `highContrast` value round-trips through
      the schema, and `textScale` changes the applied shell-root scale.
