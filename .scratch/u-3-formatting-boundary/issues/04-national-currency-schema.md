# 04: National currency configuration schema and production validation

**What to build:** A content schema and production validation for a nation's
historical currency configuration — identifier, names, symbol and position,
spacing, decimals, grouping, negatives, scale rules, period, source, gameplay
interpretation and relabel-or-transform semantics — so a bad, unsourced or
economy-altering configuration cannot compile, while the game ships none yet.

**Blocked by:** 01.

**Status:** done

- [x] A schema exists for a national currency configuration covering identifier,
      names, symbol and position, spacing, decimals, grouping, negatives, scale
      rules, period, source, gameplay interpretation, and relabel-or-transform
      semantics.
- [x] Production validation (at the content-compile boundary) rejects a
      symbol-only, floating-point-factor, unsourced, unidentified,
      locale-conflicting, or economy-altering configuration with a stable
      diagnostic; downstream stages are blocked when it is invalid.
- [x] The schema is wired into the content bundle/stage path so a configuration
      would validate when authored; no production configuration is added by this
      ticket.
- [x] A valid fixture passes and each invalid class fails; the compiler
      accumulates diagnostics and blocks downstream stages as the contract
      requires.
- [x] The configuration is presentation-only: it never changes a canonical value
      or an authoritative outcome, and no configuration is invented from guesswork
      (per-nation data is an owner decision — see spec D7).
