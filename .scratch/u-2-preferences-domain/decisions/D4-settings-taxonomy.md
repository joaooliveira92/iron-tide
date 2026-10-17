# D4: Settings taxonomy, value types, defaults, validation

**Type:** grilling · **Status:** resolved

## Question

What are the exact preference keys, their value types, defaults, and validation
rules — and which are manual-backed versus Bluewave presentation design?

## Answer

The key set and defaults, grounded per ADR-0203 and the U-2 research note
(`docs/research/u-2-preferences-domain.md`). Every value is strict; unknown keys
and out-of-range values are rejected at the strict boundary and **recovered** (D5),
never accepted silently.

App scope:

| Key | Type | Values | Default | Grounding |
| --- | --- | --- | --- | --- |
| `theme` | enum | `system`, `light`, `dark`, `highContrast` | `system` | Bluewave (ADR-0203); `highContrast` is U-4 |
| `background` | enum | the eight existing styles | `water` | Bluewave; existing setting |
| `font` | enum | `inter`, `jakarta` | `inter` | Bluewave; existing setting |
| `textScale` | integer percent | bounded steps (e.g. `85`–`130`) | `100` | Bluewave (ADR-0203); integer for deterministic migration |
| `interfaceDensity` | enum | `comfortable`, `compact` | `comfortable` | Bluewave; existing setting |
| `reducedMotion` | enum | `system`, `reduce`, `noPreference` | `system` | Bluewave (ADR-0203) |
| `language` | enum | `en` (English only initially) | `en` | Bluewave (ADR-0209); manual English-only |
| `formattingLocale` | enum | locales with automated formatting tests (initially `en-US`) | `en-US` | Bluewave (ADR-0209); manual silent |
| `measurementPreset` | enum | `imperial`, `metric` | `imperial` | manual p.18 (imperial default + rationale) |
| `measurementSelections` | per-category map | category → unit, validated against the canonical table | preset default | Bluewave (ADR-0202/0203) |
| `numberScale` | enum | e.g. `full`, `abbreviated` | `full` | Bluewave (ADR-0203) |
| `tooltipDetail` | enum | e.g. `minimal`, `standard`, `detailed` | `standard` | Bluewave (ADR-0203); manual silent |
| `currencyDisplayMode` | enum | `navalCredits`, `budgetPoints`, `nationalHistorical` | `navalCredits` | Bluewave (ADR-0206/0207/0208/0211); manual silent |

`currencyDisplayMode` has **no** `customCurrency` and no fallback-status value
(ADR-0208). The stored value is the **request**; the effective mode is derived
(D5).

Campaign scope (migrated from the existing display preferences): the four
booleans `showDetailedTooltips`, `confirmBeforeTurn`, `showUnitFatigue`,
`showSupplyOverlay`, each with its current default.

Session scope: the same keys may be held transiently, in memory only.

Not preferences: campaign-start options (research speed, technology variation,
historical budgets, legacy-fleet build) are compiled new-game configuration; save
slots/autosave cadence are F-4; tactical realism/report/map/auto-pause/game-speed
are T-2. The autosave-interval and report/map/auto-pause enumerations are
**manual-silent** and stay out of U-2 (see the research note §5/Deferred).

## Why

ADR-0203 enumerates the keys; the research note establishes that the manual
supplies **meaning** for only measurement units (p.18), save slots/autosave
(pp.22-23), realism levels (pp.98-99), report/map/auto-pause (pp.81/88/98), game
speed (p.88), and floatplane launch (p.119) — and that `theme`, `textScale`,
`interfaceDensity`, `reducedMotion`, `tooltipDetail`, `numberScale`, `language`,
`formattingLocale`, and `currencyDisplayMode` are **Bluewave presentation design**,
not manual facts. Storing `textScale` as an integer percent keeps migration and
validation deterministic. The `measurementPreset` default (imperial) is the one
setting whose *default* is manual-backed (p.18).
