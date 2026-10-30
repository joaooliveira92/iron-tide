# ADR-0201: Sole 1880 start

Applies to: content, campaign

## Status

Superseded by: ADR-0348

Accepted (2026-10-15). New record of decision DR-001; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

The RTW3 manual offers scenario starts in 1890, 1900, 1920, and 1935 (manual p.21).
Bluewave does not inherit that set. The project chose one scenario so that content,
technology progression, and validation stay bounded and reviewable. The 1880 scenario
is authored production content, not an experiment.

## Decision

1880 is the sole start year. The scenario is treated as production. No 1890 or other
start is added without a new accepted decision. Language that implies a 1890 start is
corrected; the manual's 1890 start is a deliberate divergence recorded here, not a gap.

## Consequences

- Content, technology, and the 1880 campaign-viability window are authored around 1880.
- Start-year work is re-baselined on this decision rather than on the manual.
- Any later start requires a superseding ADR.
