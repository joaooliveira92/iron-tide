# 08: Author sourced production values

**What to build:** The production 1880 pack carries sourced prestige: scale and
bounds, per-nation starting value, loss rates and gain magnitudes per reason code,
per-month sacking probability. Every value cites its source in
`docs/research/`. Values the sources do not give stay unresolved and return to
the owner (nothing invented).

**Blocked by:** 01, 02, 03, 04, 05, 06. Gated by decision request **0003**
(resolved 2026-10-17 as Option B: research first, then author sourced values),
which is not a ticket.

**Status:** blocked

- [ ] Decision request 0003 is resolved and recorded as an ADR (ADR-0225 records
      the research-first path; adopted values are recorded here when sourced).
- [ ] Each production value has a citation or an accepted-decision reference.
- [ ] Nine playable nations and five AI-only nations all load with prestige.
- [ ] Production content compiles; no fixture value appears in the production pack.
- [ ] Authoritative golden hashes re-pinned with cause per the golden repinning
      doc, only if the baseline exists (ADR-0210).
