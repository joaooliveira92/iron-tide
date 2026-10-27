# Fleet-management v2 value grounding

Ticket #267, spec #265. Companion to ADR-0314.

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

## Training cost and exercise tension (ADR-0303)

Searched 2026-10-25. Reliability is stated per source; nothing here is a game value.

- Japanese training emphasis: secondary and general sources agree the Imperial Japanese Navy drilled for night action and special
  lookouts before 1942 ([Naval History, "Triumph: US Navy night fighting"](https://www.usni.org/magazines/naval-history-magazine/2006/october/triumph-us-navy-night-fighting);
  a review of *Fighting in the Dark* on [fourmilab](https://scanalyst.fourmilab.ch/t/this-weeks-book-review-fighting-in-the-dark/3107)). Reliability: secondary. No source measures a cost or
  efficiency difference.
- Exercise and tension: the sources found cover the 1898-1914 naval race and the Morocco crises, not manoeuvres as a trigger
  ([German History in Documents, Tirpitz 1920](https://germanhistorydocs.org/en/wilhelmine-germany-and-the-first-world-war-1890-1918/england-and-the-german-fleet-alfred-von-tirpitz-looks-back-on-the-naval-race-1920.pdf)). Reliability: primary memoir for the direction
  (fleet size drove hostility), nothing for a per-exercise effect.
- Conclusion: direction only. The multiplier (japan 8000) and the dormant tension block are balance targets, not sourced figures.
