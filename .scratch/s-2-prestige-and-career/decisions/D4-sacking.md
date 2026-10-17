# D4: Sacking

**Type:** grilling · **Status:** resolved

## Question

How does "16 or below, you run a risk of being sacked" become deterministic
behaviour?

## Answer

Only the player's nation can be sacked (manual: "losing the game"). A dedicated
monthly phase after the month's prestige sources reads the player's prestige; at
or below the threshold it draws from a domain-separated RNG stream keyed to
nation and month, records stream identity, entity key, input hash, draw and
outcome, and on a sack sets a terminal career state. A sacked campaign accepts no
further commands and advances no further months; this is a normal outcome, not an
error. The threshold of 16 is manual-stated; the per-month probability is a D6
value.

## Why

"Risk" means chance, not certainty, so it needs the repo's recorded-RNG form; a
new phase keeps the footprint explicit under the phase registry contract.
