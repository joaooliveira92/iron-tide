# ADR-0339: Scenario opening conditions & technology unlock discipline

Consolidates: ADR-0212, ADR-0213, ADR-0229

Applies to: content, campaign, ship-design, content-compiler, content-schema, phase-engine

Rule: The 1880 scenario opening posture, initial-fleet legality and technology year are authored canon, with technology year acting as a global calendar-only designer unlock gate.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0212
Supersedes: ADR-0213
Supersedes: ADR-0229

## Context

The 1880 scenario (ADR-0201) opened with three unresolved questions that could not be settled from existing facts or code alone. First, starting ships had no legality rule: per-nation completed technologies were uneven (UK 8, five nations 0) and the only ship↔technology link in the code was the designer-side `unlockedTechs` keyed off global technology `year`, never per-nation `completedTechs`. Two readings were plausible — a ship is legal only if its nation completed every required technology, or if the technologies existed globally by 1880 (ADR-0212). Second, the opening posture (diplomacy, squadrons, divisions, officers) was flat and uniform — every nation pair neutral at tension 5, zero divisions, uniformly shaped officer rosters — requiring authored values whose directions are historical but whose magnitudes are design choices, not citable facts (ADR-0213). Third, technology `year` was consumed differently by the designer (calendar unlock for all nations) and the research phase (which resolved its own stub ids and ignored content technologies entirely), creating an unreconciled ambiguity about what `year` means as a gate (ADR-0229). Each decision resolves a specific gap in the scenario opening and clarifies the relationship between authored content and the engine.

## Rules

### 1. Initial-fleet tech legality

1. A starting ship is legal if the technologies its design requires were available by 1880 (year ≤ 1880) in the global technology set.
2. Per-nation `completedTechs` do not gate inherited starting ships, new construction, modernization, or design availability — the designer gate is global and calendar-only (Rule 3).
3. Starting ships without a modeled design are carried by an explicit, documented exemption (a recorded reason), never a fabricated design or technology link.
4. No starting ship may be silently illegal: each must be design-linked and 1880-legal or explicitly exempted.

### 2. Opening posture authorship

1. The 1880 opening posture (diplomacy, squadrons, divisions, officer rosters) is authored canon — directions follow citable history, magnitudes are balance choices.
2. Each magnitude is recorded with `kind: balance_adjustment` and `sourceStatus: BALANCE_TARGET`, explained in its provenance note.
3. The compiled artifact is the single source of truth: relations, squadrons and divisions are validated content, not runtime invention.

### 3. Technology year as global designer unlock

1. Technology `year` is the global designer/construction unlock year: a technology with `year ≤ calendar year` is available to every nation's designer from January of that year, regardless of per-nation research state.
2. This is not a claim about RTW3 research or per-nation discovery — the game diverges from the manual's research-driven unlock model.
3. Per-nation research wiring that would connect content technologies to the research phase is deferred; any future milestone that introduces nation-specific discovery must supersede or amend this record.