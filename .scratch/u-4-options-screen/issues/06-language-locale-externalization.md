# 06: Language section, formatting locale, and string externalization

**What to build:** The language and formatting-locale controls, plus the string
catalogue the whole screen reads from — English only, with a complete en-US
fallback and no raw keys — so labels are externalized and the language and number
formatting are independent choices.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] A stable-keyed string catalogue with a resolver exists; a missing key falls
      back to en-US with a development warning and **no raw key renders** in the
      production path.
- [ ] The Options screen's strings are migrated onto the catalogue (no inline
      literals remain on the screen).
- [ ] The language control lists only fully supported languages (English only);
      the formatting-locale control lists only locales with automated formatting
      tests (`FORMATTING_LOCALES`, initially `en-US`).
- [ ] Language and formatting locale are independent: changing one does not change
      the other.
- [ ] A test asserts the fallback warning, the absence of raw keys, and the
      independence of the two controls.
- [ ] The remaining released screens' string migration is a recorded scope
      boundary (in U-4 if sized, else a bounded follow-on), not silently deferred.
