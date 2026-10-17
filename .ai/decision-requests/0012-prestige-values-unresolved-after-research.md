# Decision Request: Prestige production values remain unsourced after the 0003-B research

## Status

Blocked pending owner decision. Returns the residue of decision
[0003](0003-prestige-scale-and-values.md) (Option B) as required by that decision
and ADR-0225. S-2 ticket 08 stays blocked; no production prestige value has been
or will be authored without this decision.

## Trigger

Decision 0003-B authorized research against high-trust sources and directed that
every unresolved or contradictory value be returned to the owner individually.
The research is complete (`docs/research/rtw3-prestige-values.md`). It grounded
the prestige _model_ but grounded almost none of the _numbers_ S-2 needs to run
the mechanic. Committing the observed-but-unsourced figures would fabricate
canonical gameplay (AGENTS.md stop condition), so they are returned here rather
than adopted.

## Evidence

`docs/research/rtw3-prestige-values.md` (full citations, per-value provenance
classes). Grounded (documented RTW3 / reverse-engineered, trusted):

- Prestige is a plain integer, one value per nation (save field `Prestige=<int>`).
- A fresh campaign starts every nation at **20** (observed in fresh 1900/1935
  saves), with one contradiction (below).
- The sacking threshold is **≤ 16**: "If your prestige goes too low (16 or below),
  you run a risk of being sacked" (manual p.62), and the risk is non-deterministic.
- Every source of loss/gain exists and loss is "in most cases proportional"
  (manual pp.12, 61–62).
- End-of-career prestige **is** the career "victory points" score saved to a Hall
  of Fame (manual pp.12, 62).

Ungrounded or contradictory (the residue): listed below. No scale upper/lower
bound, no per-source fraction, no gain magnitude, no sacking probability, and no
score formula is documented or reliably observed.

## Why agent judgment is insufficient

These numbers change who is sacked and when, and the final career score — i.e.
authoritative outcomes and every downstream golden hash. They also decide whether
Bluewave mirrors RTW3 or deliberately diverges, and the provenance the values
carry (a reverse-engineered observation is not a manual fact). Decision 0003-B
does not authorize substituting a Bluewave calibration.

## Values returned individually

1. **Prestige upper bound** — none documented; community careers reach 302. Unresolved.
2. **Prestige lower bound (stored field)** — none documented; play ends at ≤16. Unresolved.
3. **Player's fresh-start value** — 20 in most fresh saves, but **19** for the
   player in both "US 1900 Start" saves. Contradictory.
4. **Whether AI-nation prestige is live** — stored, hidden, observed constant 20.
   Unresolved.
5. **Per-nation 1880 starting values** — RTW3 has no 1880 start, so no RTW3 values
   exist; and five Bluewave nations (ottoman_empire, netherlands, portugal,
   brazil, 1880 `qing`) have no RTW3 counterpart. Any differentiation (or the
   flat-20 rule) is a Bluewave balance decision, not a source. Unresolved.
6. **Per-source loss fractions** — only single-player anecdotes exist
   (defeat ≈ −10 at ~195 prestige; bad defeat ≈ −20; early capital-ship loss 1–2;
   soft event answer −1; Caution buy-off = 10% of current prestige). Unresolved.
7. **Per-source gain magnitudes** — community reports +1 to +2 per battle with a
   possible per-battle cap; no documented magnitude. Unresolved.
8. **Monthly sacking probability at ≤16** — entirely unsourced (not in the manual,
   patch notes, save format, or community sources). Unresolved.
9. **Final-score formula** — "final prestige is the score" is documented; any
   conversion, scale, or Hall-of-Fame computation is unsourced. Unresolved.
10. **"Victory points" vs "prestige" interaction** — the manual uses both terms;
    the battle-VP system and the career-prestige system are distinct, but their
    interaction is not fully specified. Partially contradictory.

## Options

### Option A: Owner supplies the values

- Behavior: the owner provides the scale/bounds, per-nation 1880 starts (or the
  flat-20 rule), per-source loss fractions and gain magnitudes, the monthly
  sacking probability, and the final-score rule, with provenance for each.
- Advantages: authoritative and unambiguous; matches "simulation matches RTW3".
- Risks: the owner may not hold the original data; some values may not exist.
- Compatibility impact: none until adopted (then a new baseline).
- Migration impact: none (no prior prestige state).
- Scope/effort: S-2 ticket 08 plus an ADR once supplied.

### Option B: Adopt the grounded model, and authorize the residue as Bluewave balance decisions

- Behavior: adopt the grounded facts (integer, flat-20 start, ≤16 non-deterministic
  sack, proportional loss, final prestige = score); explicitly accept the
  unsourced magnitudes as ADR-0213 `balance_adjustment` values with a recorded
  rationale, re-tuned by the balance sweep.
- Advantages: unblocks S-2; every admitted choice is explicitly labelled.
- Risks: a deliberate divergence from RTW3; the "simulation matches RTW3"
  constraint must be waived for these values by the owner.
- Compatibility/migration: as Option A once authored.

### Option C: Keep S-2 blocked

- Behavior: hold S-2 ticket 08 until a higher-trust source appears (e.g. further
  NWS forum access, a data-mining pass with lawful game files).
- Advantages: no unsourced value ships.
- Risks: S-2 (prestige/career) remains incomplete indefinitely.

## Recommendation

Option B if the owner accepts the divergence, else Option A. The model is grounded
well enough to implement; only the magnitudes need an owner decision. Do not
implement ticket 08 or author any production prestige value before the owner
chooses.

## Work safely completed while blocked

- The 0003-B research note (`docs/research/rtw3-prestige-values.md`) with per-value
  provenance classes and full citations.
- ADR-0226 records the research outcome and keeps S-2 gated on this decision.
- No production content, code, or golden file was changed by the research pass.
