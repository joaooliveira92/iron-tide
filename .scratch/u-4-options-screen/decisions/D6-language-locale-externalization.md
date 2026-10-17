# D6: Language, formatting locale, and string externalization

**Type:** grilling · **Status:** resolved

## Question

How are the language and formatting-locale controls built, and how are strings
externalized?

## Answer

- **Language control** lists only fully supported languages — English only
  initially (`LANGUAGE_PREFERENCES`); no placeholder languages appear (ADR-0209).
- **Formatting-locale control** lists only locales with automated formatting tests
  (`FORMATTING_LOCALES`, initially `en-US`); it is independent of language, and
  changing it never changes language (and vice versa).
- **Externalization framework.** U-4 introduces the string catalogue ADR-0209
  requires: strings are keyed by stable identifiers, resolved through a catalogue
  with a complete `en-US` fallback, and a missing key falls back to en-US with a
  development warning and **no raw keys in production**. U-4 migrates the **Options
  screen's** strings onto it; the remaining released screens' strings migrate in a
  bounded follow-on (or in U-4 if the effort allows), recorded as a scope boundary
  rather than silently deferred. Content display keys (nations' `displayNameKey`)
  are content-side and are not U-4's catalogue.

## Why

ADR-0209 requires externalized, stable-keyed strings with a complete en-US
fallback and no placeholder languages; the sprint row requires "All strings
externalized" on the Options screen and "lists only fully supported languages /
tested locales". Introducing one catalogue + resolver, and migrating the screen
U-4 owns, keeps the framework demonstrable without an unbounded all-screens sweep.
