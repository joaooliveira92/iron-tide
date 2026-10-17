# 04: Single unrest-change seam with closed reasons and ledger

**What to build:** One operation, reachable from a monthly phase, changes a nation's
unrest by reason code. Each change is a domain event with before, after, reason and
ruleset version. A test drives a fixture month where scripted sources raise and lower
unrest and observes snapshot and events.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Unrest never leaves its bounds; arithmetic is checked and rejects non-integers.
- [ ] Every change appears in the event stream with a stable reason code.
- [ ] The vocabulary is closed and exported; `EVENT` and `SOCIAL_PROGRAMME` are
      reserved with no source and a test proving no phase emits them.
- [ ] The dedicated unrest phase is registered after battle resolution and before the
      next revenue, with permissions declared; phase order is tested.
- [ ] Magnitudes come from the fixture ruleset, not phase literals.
