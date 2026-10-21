# Decision Request: S-5 cramped and short-range ship classification

## Status

Blocked pending owner decision.

## Trigger

S-5 05 (#79) counts a cramped or short-range ship at a ruleset fraction (decision request 0020, still open). To apply it the engine must know which ships are cramped and which are short-range. Neither fact is on a compiled design or ship today, and the manual gives no range threshold for the `L`/`S` codes.

## Evidence

- Manual p.46: cramped accommodation and short range ships "count as less than their actual displacement". p.48: codes `a` (cramped) and `L`/`S` (range). p.42: "Cramped accommodation saves weight". No range figure, in nautical miles or otherwise, is given anywhere (research note `docs/research/s-5-presence-and-base-limits.md`; this value is absent from its provenance table).
- Repo: the designer's accommodation standards are `SPARTAN`/`STANDARD`/`GENEROUS` (`BriefPanel.tsx` labels SPARTAN "Cramped"); machinery carries `rangeNmAtCruise`; the colonial advisory uses a 3000 nm cruise threshold for a different question (`colonialService.ts`) and must not be reused.
- ADR-0247 reads two optional flags on `CompiledDesignVersion`, `crampedAccommodation` and `shortRange`. Nothing writes them, so no production ship is reduced.

## Why agent judgment is insufficient

The short-range threshold decides which production ships count in full, so it moves every shortfall once authored. Mapping SPARTAN to cramped is plausible but unconfirmed, and writing either flag at design compile changes compiled design hashes.

## Options

### Option A: Owner supplies the classification

- Behavior: the owner states the accommodation standard that is cramped and the cruise range (nm) below which a ship is short-range, with provenance.
- Advantages: unambiguous; also feeds the `a` and `L`/`S` projection codes.
- Risks: the source game's figure may not be available.
- Compatibility impact: none until written; writing flags changes compiled design versions of affected designs.
- Migration impact: none for saves (optional flags).
- Scope and effort: a ruleset value plus a ship-design compile step.

### Option B: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner waives fidelity and admits SPARTAN as cramped and a chosen range threshold, labelled `balance_adjustment`.
- Advantages: unblocks classification.
- Risks: divergence from the manual.
- Compatibility impact and effort: as Option A.

### Option C: Keep dormant

- Behavior: no design is classified; the fraction never applies.
- Advantages: nothing invented.
- Risks: cramped and short-range ships are credited in full.

## Recommendation

Option A, else B. Do not write either flag before the owner chooses.

## Work safely completed while blocked

S-5 05 measures presence from the two optional flags and tests the fraction with fixture-class values only.
