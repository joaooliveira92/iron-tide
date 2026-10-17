# 03: Dev warning for untranslated settings strings

**What to build:** The settings string catalogue warns in development when a key is
missing, mirroring the content-message catalogue, while production still renders the
en-US fallback and never a raw key.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] `renderer/lib/strings.ts` gains a dev-only missing-key warner (overridable for
      tests), matching `renderer/content/uiCatalogue.ts`.
- [ ] A missing key falls back to the complete en-US catalogue; only a total miss
      warns and returns the fallback, never the raw key.
- [ ] The warner never fires in production; a test pins both the dev warning and the
      no-raw-key guarantee.
- [ ] Language and formatting locale remain independent.
