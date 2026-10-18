# Decision Request: 1880 government type classification for S-3

## Status

Blocked pending owner decision. Gates S-3 ticket 14 only (ticket 09 uses a fixture
mapping).

## Trigger

Revolution is "less likely in liberal democracies" (manual p.62). The manual lists six
government types (p.60) but does not classify the 1880 nations. Content authors a
political system per nation (constitutional, federal, dual and autocratic monarchy;
parliamentary and presidential republic; Meiji; khedivate; others). Mapping each to a
manual type is a gameplay classification: for example Germany and Austria-Hungary could
be limited democracy or autocratic, Japan and the Ottoman Empire eastern or autocratic.

## Evidence

- Manual p.60 (types), p.62 (revolution), p.70 and p.77-78.
- `packages/content-schema/src/nation.ts` political systems; `content/production/1880/countries.yaml`.

## Why agent judgment is insufficient

Two plausible mappings change which nations resist revolution, so they change
authoritative outcomes.

## Options

### Option A: Derive from political system with a documented table (recommended)

- Behavior: a ruleset table maps each political system to a type; owner reviews it.
- Advantages: single source of truth; auditable. Risks: borderline nations are judgment.
- Compatibility impact: part of ticket 14's single re-pin. Scope: one table.

### Option B: Author government type directly per nation

- Behavior: a new required content field per nation.
- Advantages: explicit. Risks: second source beside `politicalSystem`; dual maintenance.

## Recommendation

Option A with a research note justifying each borderline nation.

## Work safely completed while blocked

Ticket 09 with a fixture mapping and the no-default diagnostic.
