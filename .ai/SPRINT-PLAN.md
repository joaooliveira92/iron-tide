# Bluewave Sprint Plan

Status: living backlog, rebuilt 2026-10-15 from (a) the code and content as they
stand and (b) the _Rule the Waves 3_ manual (`docs/Rule the Waves 3 Manual EBOOK.pdf`,
cited as "manual p.N"). Direction and accepted scope (DR-001..DR-011, 2026-10-15) are in `.ai/ROADMAP.md`. The previous plan (B0–B10,
A–E, P-0..P-6, EFFECT-V4) is in git at `43177f4:.ai/SPRINT-PLAN.md`; its ADR, DESIGN
and `.scratch` references do not resolve in this checkout.

## How to read this

- **Gate criterion (all sprints):** a capability is `ACCEPTED` only when a
  deterministic test drives it from a compiled campaign month and observes its effect
  on authoritative state. Code that merely exists does not count.
- **Standing gate:** `pnpm preflight`, `pnpm test:scripts`, `pnpm check` green on the
  exact commit; goldens re-pinned only per `docs/agents/golden-repinning.md`.
- **Unknown values:** the manual states rules and some numbers, not full tables.
  Anything it does not give is researched into `docs/research/` or raised as a
  decision request. Never fabricate (AGENTS.md stop conditions).
- Sizes: S ≤ 1 week, M ≈ 2–3 weeks, L ≈ 4+ weeks of one agent pipeline.

## Verified baseline (2026-10-15)

`pnpm preflight` exits 0 (40 tasks, content lock, version 0.5.0). Branch
`refactor/comment-prune-sweep-a`, 20 commits, no remote.

| Area              | State                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine, strategic | 17-phase monthly pipeline (revenue, AI planning/procurement, commands, appropriation, maintenance, construction, diplomacy, research, aircraft/carrier development, battle generation/resolution). Fleet moves one route hop a month. Divisions and officers (3 ranks, accuracy skill only). Blockade, war score, peace settlement. |
| Engine, tactical  | `combat` ≈ 55.6k LOC, 287 test files. Reachable from a campaign: gunnery, weather, damage, torpedoes, smoke, damage control, AA. Built but not reachable: mines, submarines, coastal defence, air combat, carriers.                                                                                                                 |
| Ship design       | `ship-design` ≈ 25.6k LOC: component designer, studies, rebuild/conversion, build time, docks and expansion, foreign contracts, acceleration, halt/cancel. Closest to manual pp.23–33.                                                                                                                                              |
| AI                | `ai` ≈ 0.6k LOC: uniform-random legal budget and research commands; procurement plans designs and builds. No doctrine, no war decisions.                                                                                                                                                                                            |
| Content           | 14 nations, 80 areas, 62 possessions, 86 routes, 19 fleets, 84 techs across 10 fields, ending 1939. One scenario (1880). Scenario IDs 1900/1920/1935/1960 are declared in code with no pack.                                                                                                                                        |
| Desktop           | Production screens: new game (nation, archetype, fleet method, briefing), Overview, Treasury, Construction, Shipbuilding, Fleet (divisions), Research, Diplomacy & War, Preferences, Options. Debug-only: Simulation, Tactical Sandbox, Debugging. Strategic map is an unregistered prototype.                                      |
| Repo health       | ADRs, DESIGN docs, `docs/research`, `.scratch`, `golden/hashes.json` absent. `.ai/REQUIREMENTS.md` emptied. Decision request 0001 open.                                                                                                                                                                                             |

## Gap against the manual

| Manual area                                                                           | Status                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Budget, colonies, oil, research priorities (pp.12–17)                                 | Partial. Treasury, appropriation rate and priorities exist; colonial income decay, oil gating, 12% research cap with diminishing returns above 10% to be verified. |
| Prestige, sacking, Hall of Fame (pp.12, 61–62)                                        | Missing in the engine.                                                                                                                                             |
| Unrest, revolution (p.62)                                                             | Missing.                                                                                                                                                           |
| Government type, national characteristics (pp.59–60)                                  | Missing.                                                                                                                                                           |
| Events and crises, hawk/dove answers (p.61)                                           | Missing.                                                                                                                                                           |
| Tension levels (p.60)                                                                 | Present as 0–10 per relation; no rise or event drivers.                                                                                                            |
| Intelligence (pp.63–64)                                                               | Empty shell state.                                                                                                                                                 |
| Arms limitation treaties (p.65)                                                       | Missing. `treaty` appears only in design and combat code.                                                                                                          |
| Alliances, tech sale, revocation (pp.65–66)                                           | Partial: alliance auto-entry exists.                                                                                                                               |
| Peace and possession choice (p.66)                                                    | Partial.                                                                                                                                                           |
| Ship readiness: active, reserve, mothballed, working up (pp.48, 51)                   | Missing. Ship has hit points, speed, firepower, armour only.                                                                                                       |
| Foreign stations and naval presence (pp.45–47)                                        | Missing.                                                                                                                                                           |
| Special training, fleet exercise (pp.52–53)                                           | Missing.                                                                                                                                                           |
| Divisions (pp.54–56)                                                                  | Present.                                                                                                                                                           |
| Officers: ability reveal, traits, promotion, academy (pp.56–59, 143)                  | Partial.                                                                                                                                                           |
| Trade protection, raiders, merchant war (pp.70–72)                                    | Missing.                                                                                                                                                           |
| Submarine policy, ASW, operational mining (pp.33–36, 72–74)                           | Missing at campaign level.                                                                                                                                         |
| Invasions, blitzkrieg, surprise attack (pp.68, 74–76)                                 | Missing at campaign level.                                                                                                                                         |
| Fuel shortage (p.77)                                                                  | Missing.                                                                                                                                                           |
| Blockade rules, 110% and national multipliers (p.70)                                  | Partial.                                                                                                                                                           |
| Accept or decline battle, support forces (p.67)                                       | Missing; battles auto-resolve.                                                                                                                                     |
| Fight a battle: OOB, formations, roles, force orders, realism, objectives (pp.78–101) | Engine pieces exist; no production UI.                                                                                                                             |
| Aircraft, carriers, airbases, strikes (pp.102–120)                                    | Engine modules; no UI, content or airbase building.                                                                                                                |
| Radar, missiles, CIWS (pp.121–128)                                                    | Engine partial (AA); no content or UI.                                                                                                                             |
| Coastal artillery building (p.36)                                                     | Engine model; construction screen marks it deferred.                                                                                                               |
| Saves: 9 slots, autosave, copy (pp.22–23)                                             | Partial; per-campaign saves and monthly autosave exist.                                                                                                            |
| Start years (p.21)                                                                    | Not a gap: 1880 is the sole deliberate start (DR-001). Declared 1900/1920/1935/1960 scenario IDs must stop being selectable.                                       |
| Options, units, currency (p.18, DR-002/003)                                           | One `OptionsScreen.tsx`; theme, density and font contexts exist; no preferences domain, unit or currency formatting.                                               |

Out of scope: installer and account pages, Windows hotkeys, turret-file and ship-picture
authoring (`ship-visual` is presentation-only), human-vs-human play (manual p.18), the
1960 scenario and 1970 end, radar-centric, missile-era and postwar content (DR-004),
any 1890 start (DR-001).

## Sequence

### Phase 0 — Re-ground and scope

| #   | Sprint                                                 | Size | Depends on   | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------ | ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-0 | Resolve decision request 0001 by selective restoration | S    | owner        | Governing decision: restore authoritative artifacts that exist in history; never adopt the reduced checkout as the complete baseline, and never restore wholesale. If G-1 confirms artifacts never existed, re-baseline under DR-010 rather than wait. Request closed with this decision recorded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| G-1 | Artifact inventory, re-baselining and authority index  | M    | G-0          | Finite, time-boxed investigation per DR-010. Inspect `git log --all --full-history -- <path>`, `git rev-list --all --objects`, tags, dangling objects, historical versions of ROADMAP and SPRINT-PLAN, CI config and generator scripts; record commands and refs. Classify each cited artifact: recovered, existed under another path, generated and untracked, aspirational, from another checkout, or untraceable. Publish an **unavailable-artifact register** (path, citing document, investigation, classification, ever tracked, purpose, replacement authority, reconstruction work, effect on later sprints). Unavailable items are "unavailable and unverified legacy references", never recreated from filenames; replacements take new identifiers, current dates, cite evidence and separate confirmed behaviour from new design. Publish the authority index. Done when no later sprint depends on an unidentified document; unavailable legacy files then no longer block execution. Also land `docs/research/rtw3-manual-baseline.md`, `.ai/REQUIREMENTS.md`, DR-001..DR-011 as ADRs. |
| G-2 | Finish P-2 ship designer gate                          | S    | G-0 Option A | Ticket 30 closed; acceptance report with golden verify. Skipped under Option B.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| G-3 | Scope clean-up                                         | S    | G-1          | Only 1880 is selectable; `scen_1900/1920/1935/1960` not offered anywhere; USA set AI-only; roster of nine verified by test (superseded by ADR-0214: ten playable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Phase 1 — The 1880 scenario (DR-001)

Golden hashes: if `golden/hashes.json` never existed (DR-010), do not restore or derive it
from an arbitrary run. The first baseline is created once canonical serialization is
documented, seeds and clocks are controlled, the 1880 scenario passes structural
validation, deterministic replay is demonstrated, presentation preferences are excluded
from authoritative state, and the output is reviewed. It is a new baseline, not a restoration.

| #   | Sprint                  | Size | Depends on | Acceptance                                                                                                                                                                                               |
| --- | ----------------------- | ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-1 | 1880 scenario audit     | M    | G-1        | Per-nation report on fleets, classes, queues, budgets, maintenance, docks, tech state, research priorities, relations, possessions, presence. Every ship legal under 1880 tech. Findings become tickets. |
| N-2 | 1880 content completion | L    | N-1        | Gaps closed from research notes; abstractions documented; no later tech copied in. Ten nations each pass a campaign viability test and a deterministic smoke run.                                        |
| N-3 | 1880–1890 progression   | M    | N-2, S-1   | A scripted 10-year run shows decisions and unlocks each year (docks, torpedoes, protected cruisers, steel, QF guns); no idle stretch.                                                                    |

### Phase 2 — Canonical values and Options (DR-002, DR-003)

| #   | Sprint                  | Size | Depends on | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U-1 | Canonical values        | M    | G-1        | Canonical unit table; fixed-precision integer monetary representation; rounding and number-formatting boundaries; UI language and formatting locale defined as separate concerns; audit of float or display-leaking values; conversion only at the application boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| U-2 | Preferences domain      | M    | U-1        | Versioned schema, central defaults, validation, deterministic migration, atomic main-process persistence, narrow preload capability, typed selectors; app, campaign and session scopes. Settings: `language`, `formattingLocale`, `theme`, `textScale`, `interfaceDensity`, `measurementPreset`, per-category custom measurement selections, `currencyDisplayMode`, `numberScale`, `reducedMotion`, `tooltipDetail`. `currencyDisplayMode` accepts only `navalCredits`, `nationalHistorical`, `budgetPoints`; no `customCurrency` and no fallback-status value. Default `navalCredits`. The domain models `requestedCurrencyDisplayMode` and `effectiveCurrencyDisplayMode` separately; fallback is resolved runtime state and never rewrites the stored request. Corrupt or unknown settings recover without touching saves.                                                                                    |
| U-3 | Formatting boundary     | M    | U-2        | Central formatters and parsers for measurements, canonical money, Naval Credits (NC), Budget Points (BP), national historical currency, dates, localized numbers. Content-driven currency availability with validated national configurations (identifier, names, symbol and position, spacing, decimals, grouping, negatives, scale rules, period, source, gameplay interpretation, relabel-or-transform); production validation rejects symbol-only, floating-point factor, unsourced, unidentified, locale-conflicting or economy-altering configurations. Effective-mode resolution with reason codes `noActiveNation`, `nationalCurrencyNotConfigured`, `nationalCurrencyInvalid`, `nationalCurrencyOutsideSupportedPeriod`, mapped to localized messages. Naval Credits is the render and malformed-content fallback, never silent in the UI. Single parse-once input path. Boundary and round-trip tests. |
| U-4 | Options screen          | L    | U-2, U-3   | Sections General, Appearance, Measurements, Currency and Numbers, Gameplay Interface, Accessibility, Advanced; reachable from main menu and campaign; live preview, reset per section and all; themes system/light/dark/high-contrast on every released screen; text size, density, reduced motion, tooltip detail, keyboard focus, non-colour indicators. Currency control shows the three modes with the descriptions in DR-006..DR-008, defaults to Naval Credits, disables or hides National Historical when unavailable with a stated reason (no campaign; nation unsupported), shows the effective mode truthfully, never describes NC as historical, and updates when the active campaign changes. Language control lists only fully supported languages (English). Formatting-locale control lists only locales with automated formatting tests. All strings externalized.                               |
| U-5 | Presentation invariance | S    | U-4        | Same campaign hashes and unchanged canonical money under all three currency modes and every preset; fresh-profile default is NC; National Historical availability by nation, with no nation, with missing and with invalid configuration; requested mode preserved across unsupported campaigns and restored in supported ones; no silent UI fallback; unavailable-artifact classification checked; first golden hashes flagged as a new baseline; locale changes independent of language; national-currency fallback to NC; no float drift; no formatted money in saves; missing-translation fallback to en-US with a dev warning and no raw keys in production; corrupt-settings recovery; migration from earlier schemas; packaged persistence through the Electron boundary; lint gate bars ad hoc conversion, storage and date formatting in components.                                                    |

### Phase 3 — A game you can lose

| #   | Sprint                         | Size | Depends on | Acceptance                                                                                                                                                   |
| --- | ------------------------------ | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S-1 | Ship readiness and maintenance | M    | G-1        | Active/reserve/mothballed/working-up, crew quality ramp, maintenance by status, repair cost ×2, wartime maintenance. Working-up ships excluded from battles. |
| S-2 | Prestige and career            | M    | G-1        | Prestige state seeded per nation in 1880, proportional loss, sacked at 16 or below, final score.                                                             |
| S-3 | Budget pressure and unrest     | M    | S-2        | Drivers and brakes per p.62, strikes, revolution, 3–5% growth, colony decay, 12% research cap; seeded unrest.                                                |
| S-4 | Events and crises              | L    | S-2, S-3   | Catalogue with hawk/dove answers moving tension, prestige, budget; government types and traits gate eligibility. Research first.                             |
| S-5 | Foreign stations and presence  | S    | S-1        | Tonnage obligations per area, colonial-service weighting, penalties.                                                                                         |

### Phase 4 — Battles you fight

| #   | Sprint                 | Size | Depends on | Acceptance                                                                                                                                                                                                                |
| --- | ---------------------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1 | Battle offer flow      | M    | S-1        | Force estimate, accept or decline with VP and prestige cost, support force, mission types.                                                                                                                                |
| T-2 | Player-fought battle   | L    | T-1, U-4   | Sandbox promoted: OOB, formations, roles, speed, targeting, force orders, three realism modes, log, objectives, mid-battle save; overlays honour preferences and non-colour palettes; result through `battle_resolution`. |
| T-3 | Tactical fidelity pass | M    | T-2        | Grates fouled, stokers exhausted, minefields, MTBs, land targets, survivors, glare, hidden sinking state.                                                                                                                 |

### Phase 5 — A world that reacts

| #   | Sprint                               | Size | Depends on    | Acceptance                                                                                                                                                |
| --- | ------------------------------------ | ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | Goal-directed AI                     | L    | S-1..S-4, N-2 | Budget, research, design and build weighted by nation traits and rival strength; war and peace from tension; geography-aware; replaces uniform-random.    |
| W-1 | Trade protection and raiders         | M    | S-1, T-1      | Requirement scaled to fleet and submarine threat, raiders, interception, losses feed unrest.                                                              |
| W-2 | Submarines and mines, campaign level | M    | W-1           | Policies, ASW rating, operational mining, neutral anger. Wires built `combat` modules.                                                                    |
| W-3 | Intelligence                         | M    | S-4           | Levels with ramp-up, detection raises tension, restricted enemy data.                                                                                     |
| W-4 | Treaties and alliances               | L    | S-4, W-3      | Arms limitation, scrapping, cheating by non-liberal nations, tech sale, revocation.                                                                       |
| W-5 | Invasions, surprise attack, fuel     | M    | W-1, T-1      | Invasion range and escort battle, era-specific surprise attack, fuel shortage; blitzkrieg gate (1935) kept inert within the 1939 horizon unless coherent. |
| W-6 | Peace and officers                   | M    | W-4           | Possession selection by value points; officer reveal, traits, promotion, academy.                                                                         |

### Phase 6 — Frontend surfaces

| #   | Sprint                                     | Size | Depends on    | Acceptance                                                                                               |
| --- | ------------------------------------------ | ---- | ------------- | -------------------------------------------------------------------------------------------------------- |
| F-1 | Strategic map                              | M    | S-5, U-4      | Prototype promoted: pan/zoom, fog-of-war tooltips, drag-to-move, Suez and Panama gating, invasion range. |
| F-2 | Politics, intelligence, officers, doctrine | L    | S-4, W-3, W-6 | Production screens inside the click-depth ledger.                                                        |
| F-3 | Fleet and construction surfaces            | M    | S-1, W-1      | Status codes, hotkeys, multi-select, assignments; submarine and coastal items enabled.                   |
| F-4 | Saves                                      | S    | none          | Slots with copy and load-autosave; autosave count and frequency from Options.                            |

### Phase 7 — Roster and release

| #     | Sprint                    | Size   | Depends on    | Acceptance                                                                                                                                                                                        |
| ----- | ------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1   | Ten-nation validation     | M      | A-1, W-6, U-3 | Each of ten plays 1880 through 1939 unattended and by hand without dead states, and has a validated historical-currency configuration unless a later decision waives it.                          |
| R-2   | Promote an AI-only nation | S each | R-1           | Per nation, independently: complete 1880 start, queues, economy, design identity, research priorities, diplomacy, geography-aware AI, presentation content, viability tests, plausibility review. |
| REL-1 | Full validation           | M      | R-1, U-5      | 1880 smoke, save/restart/load, replay checkpoints, hash verification across themes, units, currencies, accessibility and packaged builds.                                                         |

## Frontier

Status (2026-10-16, autonomous run): **G-0 is resolved** (re-baselined by G-1 under
ADR-0210/DR-010; 0001's file still reads "blocked" but its finite exit was taken).
G-1 and G-3 are complete; N-1's audit is complete with ticket 07 blocked. S-1
(readiness and maintenance), S-2 (prestige), mine-warfare and **U-1 (canonical
values)** are now scoped and sliced; U-1 is also briefed
(`.ai/specs/u-1-canonical-values.md`, `.ai/briefs/u-1-canonical-values.md`), and its
**tickets 01–05 are on the actionable frontier**. The root blocker remains the
**absent golden baseline**:

1. **Golden baseline (decision request 0005).** `golden/hashes.json` does not exist,
   so `pnpm check`'s `check:golden` cannot run and no authoritative commit can meet
   the definition of done. Every sprint that adds or changes snapshot state is gated
   on it: **N-1 ticket 07**, **S-1 ticket 01** (required per-ship readiness/crew
   moves the reference run), **S-2 ticket 01** (required prestige), and the
   **mine-warfare** state ticket. Creating the baseline (or approving the guard
   procedure) is the highest-leverage unblock.
2. **S-2 ticket 01** is additionally blocked on decision request **0006** (a required
   prestige field cannot coexist with untouched production content), blocking S-2
   02-09.
3. **S-1 tickets 01-09** are blocked: 01 on 0005; 02-07 transitively (and by
   decision request **0007**, the readiness/crew/maintenance values); 08 on 0007.
4. **mine-warfare (W-2)** tickets 01/02 are sliced but W-2's plan dependency
   (W-1, itself on S-1/T-1) is unmet.
5. **U-1** (canonical values) is scoped, sliced and briefed. Its value-preserving
   tickets **01–05** (canonical units module; consolidate unit brands; one money
   type and branded money fields; rounding helpers and the authoritative-float
   gate; conversion boundary and formatting-leak removal) can start now; tickets
   **06–08** (the combat/economy float→fixed conversions and U-1 acceptance) are
   gated by 0005 because they move the reference run.

Resolve 0005 first (golden baseline), then 0003/0004/0006/0007. The actionable
frontier is now **U-1 tickets 01–05**, plus the U-2 lane those tickets unblock.

## Decisions recorded

- **DR-001** sole 1880 start. **DR-002** canonical internal values; presentation-only
  units and currency. **DR-003** Options screen and preferences architecture.
  **DR-004** 1960 and 1970 out of scope; no empty scenario IDs selectable.
  **DR-005** nine playable nations; five AI-only behind a per-nation readiness gate (superseded by ADR-0214: ten playable).
- **DR-006** standardized currency is **Naval Credits (NC)**: a comparison unit, not a
  historical currency; labels and formatting only; no exchange-rate tables.
- **DR-007** abstract unit is **Budget Points (BP)**: same canonical values, no second
  economy.
- **DR-008** Custom Display Currency is excluded from the initial release; return
  needs a new accepted decision (value, conversion, rounding, persistence, inputs).
- **DR-009** initial UI language is English with a complete en-US fallback; formatting
  locale is independent; strings externalized and keyed by stable identifiers; no
  placeholder languages in Options.
- **DR-010** artifacts confirmed never to have existed are "unavailable and unverified
  legacy references", registered and re-baselined; authority order: accepted decisions,
  roadmap and plan, manual (except deliberate divergence), tests, production content,
  implementation (describes behaviour, not intent), new cited research. They do not
  block execution once G-1 completes.
- **DR-011** default currency is Naval Credits; National Historical is available only
  with a validated national configuration and is never silently substituted. Release
  readiness for the ten nations requires validated configurations.
- **Execution gate:** no implementation sprint starts before G-0 is resolved and G-1
  completes its finite exit condition.

Do not reopen without evidence that contradicts a higher-authority accepted decision.

## Open questions

None at the product level. Per-nation historical currency configurations are content
work inside U-3.
