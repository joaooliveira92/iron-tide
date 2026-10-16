# 05: Sacking ends the player's career

**What to build:** A new monthly phase reads the player's prestige and, at or
below 16, draws a recorded chance of being sacked. A sack sets a terminal career
state: the campaign accepts no more commands and advances no more months, and
this is a normal outcome. A fixture campaign driven below the threshold with
known seeds ends deterministically.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Above 16 no draw is made; at or below 16 exactly one draw per month is made
      from a domain-separated stream and recorded with stream identity, entity key,
      input hash, draw, outcome and reason code.
- [ ] The same seed and state produce the same outcome across processes and OSes.
- [ ] After a sack, further commands and month advances are refused with a typed
      outcome; state is not corrupted.
- [ ] AI nations at or below 16 are never sacked in S-2.
- [ ] The phase has a declared footprint in the registry and passes its guard.
