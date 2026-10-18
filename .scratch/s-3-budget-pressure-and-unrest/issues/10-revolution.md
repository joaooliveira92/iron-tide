# 10: Revolution ends a war as a harsh loss

**What to build:** A nation at war and at or above the revolution threshold may suffer
revolution each month, decided by a recorded seeded draw, damped in liberal democracies;
revolution ends its side of the war as a loss under harsher terms (map D5).

**Blocked by:** 06, 08, 09

**Status:** ready-for-agent

- [ ] Not eligible in peacetime or below threshold, proven by test.
- [ ] The draw uses a domain-separated stream and records stream identity, nation key,
      phase, ruleset version, input hash, draw and outcome.
- [ ] Liberal democracy yields a strictly lower probability than another type with
      identical inputs (tested over fixed seeds).
- [ ] On revolution the war is lost through the existing settlement path with the
      ruleset severity multiplier; the nation's government type may change per ruleset.
- [ ] Replay of the same inputs reproduces identical hashes across processes.
- [ ] Applies to AI nations; player sacking (S-2) is untouched.
