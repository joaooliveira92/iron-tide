# ADR-0209: UI language, formatting locale, and externalized strings

## Status

Accepted (2026-10-15). New record of decision DR-009; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

Language and locale are separate concerns: a player may read English while preferring
a different numeric and date formatting locale. Shipping placeholder languages would
present untranslated UI as complete.

## Decision

The initial UI language is English with a complete en-US fallback. Formatting locale
is independent of UI language. Strings are externalized and keyed by stable
identifiers. The Options language control lists only fully supported languages (English
initially); the formatting-locale control lists only locales with automated formatting
tests. No placeholder languages appear in Options.

## Consequences

- Missing translations fall back to en-US with a development warning and no raw keys
  in production.
- Locale changes never change UI language, and vice versa.
- Presentation invariance (U-5) verifies the separation.
