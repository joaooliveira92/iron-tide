# 03: UI language and formatting locale as separate settings

**What to build:** Two independent preferences — the language the player reads and
the locale used to format numbers and dates — stored and validated separately, so
changing one never changes the other and only fully supported languages are
offered.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `language` accepts only fully supported languages (initially `en`); default
      `en`; no placeholder language is storable.
- [ ] `formattingLocale` accepts only locales on the validated allowlist
      (initially `en-US`); default `en-US`.
- [ ] Selectors expose the two independently; a test proves changing language does
      not change formatting locale and vice versa.
- [ ] The values are stored as presentation preferences only; no canonical value
      or authoritative state depends on them.
- [ ] The formatters/parsers that consume these values, and the locale allowlist's
      population, remain U-3's.
