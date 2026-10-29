# ADR-0348: Authored scope and horizon

Consolidates: ADR-0201, ADR-0204, ADR-0282

Applies to: content, campaign, cross-process-test

Rule: The sole start year is 1880; the authored horizon is 1970; any declared scenario ID with no content pack must not be selectable.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0201
Supersedes: ADR-0204
Supersedes: ADR-0282
Consistent with: ADR-0339
Consistent with: ADR-0340
Consistent with: ADR-0350

## Context

Three scope decisions shaped what Bluewave authors and what it leaves for future work. The RTW3 manual offers scenario starts in 1890, 1900, 1920, and 1935 (manual p.21), but Bluewave chose one scenario so that content, technology progression, and validation stay bounded and reviewable. The manual's simulation runs from 1890 to 1970 and includes radar, missiles, and the postwar period (manual pp.121-128), but the project initially authored technology through 1939 only. Finally, scenario IDs 1900, 1920, 1935, and 1960 were declared in code with no content pack, presenting empty choices.

The campaign calendar and the S-2 career end already run to December 1970 (ADR-0281), but authored content originally stopped at 1939. A player who survives would play about thirty years with no new technology, ships or parts. The authored horizon was extended to 1970 in ADR-0282 (superseding ADR-0204), and the 1880 start was established in ADR-0201.

## Rules

### 1. Sole start year

1880 is the sole start year and is treated as authored production content, not an experiment. No 1890 or other start is added without a new accepted decision. Language that implies another start is a deliberate divergence from the manual recorded here, not a gap. Content, technology, and the 1880 campaign-viability window are authored around 1880.

### 2. Authored horizon

The authored horizon is 1970. Technology, ship-building and part content is authored for 1940 to 1970, in decade slices (1940-1949, 1950-1959, 1960-1970). The sole start stays 1880 (Rule 1).

In scope (as the manual supports them, pp.121-128): radar-era sensors and fire control, guided missiles, jet aircraft, carriers and naval aviation, and the postwar ship types of the period.

Out of scope: nuclear weapons, unless a later owner decision adds them. Postwar political events, goal-directed AI (A-1) and scenarios other than 1880.

### 3. Research-first authorship

Every date, class and value traces to the manual or another cited source in a research dossier. A value no source gives returns to the owner individually by decision request; none is invented or placeholdered (precedent ADR-0239).

A technology whose effect the engine cannot model is audited and marked inert; content never promises behaviour the engine lacks. Engine gaps become separate tickets, not part of content slices.

### 4. Empty scenario IDs

Declared scenario IDs with no content pack must not be selectable rather than appearing as empty choices. Scenario selection offers only 1880.

### 5. Goldens

Each content slice re-pins the goldens once, with old and new values and cause, per `docs/agents/golden-repinning.md`.

## Consequences

- Content, technology, and the 1880 campaign-viability window are authored around 1880.
- BW-SCP-002, the README, the sprint plan content row, R-1 and the RTW3 baseline note state 1970 as the horizon.
- Era content added later must not copy post-1939 technology in.
- Nothing in this ADR changes content, code or goldens; it gates the content tickets of spec #249.