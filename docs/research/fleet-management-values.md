# Fleet-management v2 value grounding

Ticket #267, spec #265. Companion to ADR-0283.

## Sourced (manual)

- Special training: twelve months to proficiency, benefits vanish on stopping, at most two subjects; gunnery +10% accuracy and +30% maintenance; night fighting +10% night accuracy and +20%; torpedo tactics +20%; damage control +20% (p.53). Japan pays less, no figure.
- Fleet exercise: once a year, selected ships, twice the active maintenance, "some" experience; large exercises can raise tensions (p.53).
- Division experience has a slight impact on crew quality for battle (p.55).
- Mothballing halts repair and its premium (p.51).

## Not sourced

Cohesion growth rate and cap, experience per battle and exercise, role and formation change penalties, the effect size of torpedo tactics and damage control, Japan's discount, the tension consequence. See `docs/research/s-1-readiness-and-maintenance.md` for the "not stated" list.

## Existing anchors for the targets

`DIVISION_PENALTIES`: addShip -5 experience / -10 cohesion, flagshipChange -5 / -10, changeCanonicalType -10 / -20, reorderWithoutFlagship 0 / -3. Seeded divisions start at experience 20, cohesion 30. Targets are chosen against these, not against RTW3.

## REPAIR entry

Search of the packages for writers of `readiness: "REPAIR"` finds only seed resolution. `readinessEvolution` only counts down and releases. The ship-design `REPAIR` project type feeds the construction path, which sets `availability = UNAVAILABLE` (see `startRebuild`). No combat aftermath writes damage into campaign readiness.
