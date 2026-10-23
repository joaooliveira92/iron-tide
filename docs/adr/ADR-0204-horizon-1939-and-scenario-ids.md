# ADR-0204: Authored horizon through 1939; no empty scenario IDs

## Status

Superseded by: ADR-0282 (horizon moved to 1970; the scenario-ID rule is restated there). Originally accepted (2026-10-15). New record of decision DR-004; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

The manual's simulation runs from 1890 to 1970 and includes radar, missiles, and the
postwar period (manual pp.121-128). The project authors technology through 1939 only.
Scenario IDs 1900, 1920, 1935, and 1960 are declared in code with no content pack.

## Decision

The authored horizon is 1939. 1960 and the 1970 end are out of scope; radar-centric,
missile-era, and postwar warfare await a separate expansion. Declared scenario IDs
with no pack must stop being selectable rather than present as empty choices.

## Consequences

- Scenario selection offers only 1880 (ADR-0201).
- Era content added later must not copy post-1939 technology in.
- The scenario clean-up sprint (G-3) enforces non-selectability by test.
