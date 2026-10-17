# U-2 preferences domain: what the RTW3 manual says about player-facing options

Status: new research note, created 2026-10-16 for the U-2 "Preferences domain" sprint.
Companion to `docs/research/rtw3-manual-baseline.md` and `docs/research/u-1-canonical-values.md`;
it does not restate either and cites only the passages a player-facing Options surface
would expose. Per ADR-0202/0203 the manual's options are sources of meaning and
terminology; the versioned/validated/migrated/atomically-persisted preferences domain and
its taxonomy are Bluewave architecture, not manual facts.

## 1. Question

Which settings, options, and preference concepts does the RTW3 manual name for a
player-facing Options/preferences surface — and which does it never define — so that the
U-2 spec can ground its settings taxonomy and separate manual-backed semantics from
Bluewave-only presentation design? Sub-questions: (a) the "General: starting a game,
options, starting fleet, loading and saving" section (pp.18-22); (b) the tactical-battle
preferences passage (pp.78-101, esp. p.98-99); (c) units, currency/budget display,
autosave/save slots, tooltips/advisor messages, font/text size, difficulty, and other
interface options; (d) whether the manual describes a settings screen structure at all.

## 2. Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` (the RTW3 game manual, 148 pages).
- Method: page-by-page text extraction with `pypdf` 6.14.2 (same tool/version as the
  baseline note); the extraction is a working copy under a temp dir, not a tracked
  artifact. Every quotation below was read on its printed page. Page numbers are the
  manual's printed page numbers; they match the PDF page index in these ranges
  (baseline note, "Source and method").
- Full-text keyword sweeps were run over all 148 pages for `tooltip`/`tool tip`,
  `autosave`, `advisor`, `font`, `text size`/`font size`, `difficulty`, `display`,
  `preference`, `setting`, `theme`, `reduced motion`/`motion`, `locale`, `language`,
  `currency`, `map detail`, `realism`, `measurement`, `metric`, `imperial`, `hotkey`,
  `shortcut`, `notification`, `pause`, `message box`, `toolbar`, `main screen`,
  `start screen`, `options screen`, `colour`/`color`. Hit pages are cited below; the
  zero-hit terms are recorded in §5.
- Cross-reference (not from the manual): the Bluewave preference surface is named in
  `docs/adr/ADR-0203-options-and-preferences-architecture.md` and its presentation-only
  constraint in `docs/adr/ADR-0202-canonical-internal-values.md`. `docs/OPEN-ISSUES.md`
  does not exist in this tree, so nothing there is surfaced.

## 3. Confirmed — every option the manual names, by location

### 3.1 General: starting a game, options, starting fleet, loading and saving (pp.18-22)

**p.18, MEASUREMENTS** (verbatim): "Measurements in the game are given in imperial
measurement units. Gun calibres and armour thicknesses are in inches, ranges are in
yards, bomb weights in pounds. These measurements were chosen because they are commonly
used in naval history works, and should be familiar to the majority of naval warfare
enthusiasts." — one fixed preset; no player-selectable unit setting is described.

**p.18-19, STARTING A GAME**: nation selection ("you will first select a nation … There
will be eight opponent nations"); nine playable nations (Great Britain, Germany, France,
Austria-Hungary, Russia, Italy, Japan, China, Spain); "You can only play against the AI,
there is no human vs human play." A **fleet size** choice: "You must also select a fleet
size, which determines the size of your budget, and thus the size of your fleet. The size
which most closely corresponds to real fleet sizes during the period is large or very
large." (p.18). p.19 adds the recommendation "that you play your first game with medium
or even small fleet size", and that small fleet + minor nation "is not really
recommended" (p.19).

**p.19, OPTIONS** — the heading that names the manual's campaign options (contents p.3:
"Options 19"). Verbatim, in order:
- "There is an option for setting research speed. Setting research speed lower than 100
  will slow down research."
- "There is an option for varied technologies." — with three named values: "No technology
  variation means that all technologies become available for research at the historical
  time they were developed. Some variation means that there might be a variation of one
  or two years … Considerable variation means that technologies may appear up to 6 years
  later than in reality, and their effectiveness can vary."
- "If you want to play with more historical budgets, there is an option for that in the
  1900 campaign start." (A budget-*values* option, 1900-only; see §5 re currency.)

**p.21** (continuation of OPTIONS): "There is a specific option to slow down air
development. This is for those players who want to prolong the period when battleships
dominated the seas. Historical budgets was explained above and manual build of legacy
fleet is explained in the next section."

**p.21, YOUR STARTING FLEET**: "There are options to start the game in 1890, 1900, 1920,
or 1935." The legacy fleet "is generated automatically in the 1890, 1920 and 1935 starts,
but can optionally be built manually in the 1900 start." Manual legacy-fleet build gives
"an amount of money as your starting funds"; under-construction ships start "about 50%
complete" and "you only pay 5% of the cost for work already completed" (p.21).

**p.22, LOADING AND SAVING GAMES**: "There are nine slots for saved games. When you start
a game, you will be prompted to select a save slot for your game. Games can be saved at
any time from the main screen or during battle by pressing save game. The game will
automatically be saved in the slot you selected for your game. You can also copy the game
to another save slot of you want to preserve your game at a certain point in time." Load
path: "go to the load game when starting RTW and select the slot you want to load. You can
also press continue in the start screen, which will load your last saved game." (p.22).

**p.23, AUTOSAVE**: "RTW will autosave after every month and at intervals according to
preferences during battles. Thus, if something happens that causes you to exit without
saving, game crash, power failure, whatever, you can always reload the latest autosave by
selecting the game slot and pressing 'Load autosave'."

### 3.2 Tactical battle preferences (pp.78-101)

**p.98, PREFERENCES IN TACTICAL BATTLE** (the manual's only dedicated preferences
passage) — verbatim: "There are user settings for the level of detail in most reports, as
well as what is shown on the game map. It is also possible to select what events will
pause the game. In addition, the player can chose between one of three realism levels."
It names three report/map/pause settings collectively but **enumerates no individual
toggles or their values**.

**p.98-99, realism levels** — the one preference the manual fully specifies:
- **Admiral's Mode** (p.98): "The ultimate in realism. The player can only give orders to
  the lead divisions of each force. Other divisions can be controlled only by selecting
  their role. No manual targeting is allowed."
- **Rear Admiral's Mode** (p.99): "The player can put any divisions in his force on manual
  or AI control as long as they are within sight of the force flagship. The player can
  give target orders to divisions. Victory points will be reduced by 10%."
- **Captain's Mode** (p.99): "The player can put any divisions in his force on manual or AI
  control. The player can give target orders to divisions or ships. Victory points will be
  reduced by 20%."
- "Note that many battles have friendly forces that are not under player control. This is
  not affected by the realism setting." (p.99).

Realism level is referenced as gating gameplay elsewhere: AI control of divisions is
"subject to the realism level you have chosen (see preferences section)" (p.83) and "the
AI control checkbox (possibly restricted depending on realism level)" (p.84); manual
torpedo firing at captain's mode (p.94); smoke floats "ordered manually in captain's mode,
and will be deployed … on other realism levels" (p.96).

**p.81 (THE LOG)**: "Some events will be shown in differing colour or font to make them
stand out. These are ships sinking, torpedo hits etc. Some events can also be made to
pause the game or show a message box, subject to customization by the player. See under
preferences." — i.e. per-event **pause** and **message-box** customization is a named
player preference; the manual does not list which events or the option shape.

**p.88 (PLAYING A TURN)**: "The events that will pause the game automatically are
configurable under preferences. You can adjust the game speed with the game speed control
on the toolbar. Speed varies from ultra-fast, which will have game minutes passing by at
the rate of several minutes per real life second, down to real time. Normal speed equals
roughly one game minute per real life second (varying slightly with computer performance
and the number of ships engaged)."

**p.119 (floatplanes)**: "In preferences you can set what method to use for floatplane
launch. On automatic, floatplanes will be launched according to the current search plan
for the force … If 'Ask' is selected, the player will be asked to confirm floatplane
launches … On manual, the player must launch all recon floatplanes or helicopters
manually via the strike screen." — a three-value preference (automatic / Ask / manual).

### 3.3 Cross-cutting interface options (map, log, tooltips, save, hotkeys)

- **Strategic-map options (p.14)**: "Right drag to move the map. Mouse wheel to zoom in.
  Right click in the tree to the left for more map options. Left click in any area or on a
  possession when the map is zoomed in a bit to get details." "more map options" is
  referenced but never enumerated.
- **Tool tips (pp.14, 79)**: p.14 — "Hovering the mouse over an area will give you a tool
  tip window with information about ships of all nations deployed in that area." p.79 —
  "You can hover the mouse pointer over a ship to get additional info." Tool tips are
  described as behaviour, not as a configurable preference.
- **Tactical-map display (p.79)**: toolbar buttons show "sighting ranges, visual or radar,
  gun ranges or fire lines for the selected division"; enlarge-view inset; track chart.
  These are controls, not listed as a saved preference.
- **Log export (p.81)**: "you can copy all entries to the clipboard with Ctr+C and paste
  into Word or Word Pad. It is an RTF file" — export is a capability, not an option.
- **Hotkeys (p.137, Appendix 4 "HOTKEYS IN TACTICAL BATTLE")**: 1-9 run N minutes; Enter
  run-until-paused; Space one minute; `<` five/60 minutes; P pause; Z/PgUp/- zoom out;
  X/PgDn/+ zoom in; F zoom-to-all; C increase game speed; V decrease game speed;
  A/S/D/W scroll map; mouse wheel zoom. Ship-in-service and ship-design hotkeys are on
  p.138. The manual presents these as fixed bindings; it defines no key-rebinding option.

## 4. Is there a settings screen at all?

**No.** The manual describes **only scattered, in-context options**; it never describes a
settings screen, its navigation, layout, sections, or a full list of settings.

- The contents (pp.3-6) contain **no** "Settings", "Options screen", or "Preferences"
  section. The only relevant headings are "Options 19" (a subsection of GENERAL) and
  "Preferences in tactical battle 98" (a subsection of YOUR FLEET IN BATTLE).
- A whitespace-normalized sweep returns **no hits** for `options screen`, `settings
  screen`, `settings menu`, `options menu`, or `preferences screen`. (`start screen`
  appears once, p.22, but only as the continue button — not a settings surface.) `setting`
  as an interface noun appears only in gameplay contexts (research priorities p.16,
  special training p.52, airstrike screen p.115-116, ship designer p.142).
- The manual repeatedly *refers* to "preferences" (pp.81, 83, 88, 94, 98, 119) as though a
  preferences surface exists, but it never opens it, names its tabs, or lists its entries.
  The closest thing to a contents entry is "Preferences in tactical battle 98", which is
  four sentences of scope, not a screen description.
- The Options named on p.19 (research speed, varied technologies, historical budgets) and
  on p.21 (slow air development, manual legacy fleet) are described as **campaign start
  choices**, not as a settings menu.

## 5. Deliberate divergences and what the manual does not supply

Relevant to U-2, ADR-0203 enumerates preference keys: `language`, `formattingLocale`,
`theme`, `textScale`, `interfaceDensity`, `measurementPreset` (+ per-category custom
measurement selections), `currencyDisplayMode`, `numberScale`, `reducedMotion`, and
`tooltipDetail`. The manual grounds only part of this taxonomy.

**Manual-backed semantics (meaning exists, values often do not):**

- Measurement units — one **imperial** preset; inches (calibre/armour), yards (range),
  pounds (bomb *weight*) (p.18). No metric option is described anywhere (`metric`'s sole
  hit is the substring in "asymmetric", p.30). `measurementPreset` may cite p.18 for the
  default and its rationale; canonical storage and any metric alternative are ADR/engine
  decisions (ADR-0202/0037), not manual facts (see `u-1-canonical-values.md` §3).
- Save structure — **nine** fixed save slots, one chosen at game start, manual save
  anywhere, copy-to-slot, continue-last (p.22); autosave monthly and "at intervals
  according to preferences during battles", with a "Load autosave" path (p.23). The manual
  gives **no** count/interval preference values; "intervals according to preferences" is
  undefined.
- Realism mode — three named levels with distinct player-agency rules and victory-point
  penalties of 0% / -10% / -20% (pp.98-99). This is the manual's nearest analogue to a
  "difficulty" concept, but it is a **tactical-battle** restriction, not a campaign
  difficulty setting, and the word `difficulty` does not appear in the manual at all.
- Report detail / map display / auto-pause events — named as user settings (p.98) and
  auto-pause is "configurable under preferences" (p.88); per-event pause and message-box
  customization exists (p.81). The manual enumerates **no** individual toggles, categories,
  or default values for any of these.
- Game speed — an in-battle toolbar control ranging ultra-fast → real time, reverting to
  normal on contact (p.88), with hotkeys C/V (p.137). Described as a runtime control, not
  a persisted preference.
- Floatplane launch method — automatic / Ask / manual (p.119). A genuine three-value
  preference; its home (app vs campaign vs session) is not stated.

**Not supplied by the manual (the spec must not invent these as manual facts):**

- **No settings screen or taxonomy** — no sections, tabs, grouping, or navigation (§4).
- **No `tooltipDetail` setting** — tool tips exist as behaviour (pp.14, 79); the manual
  never offers a player-adjustable tooltip-detail/verbosity control.
- **No `reducedMotion` setting** — `reduced motion`/`animation` return no setting hits;
  ships are "animated to create a smooth movement" (p.88) but there is no toggle.
- **No theme system** — `theme` returns no hits.
- **No font-size / `textScale` setting** — `text size`/`font size` return no hits; the only
  `font` mention is developer-chosen emphasis in the log ("differing colour or font",
  p.81), not a player setting.
- **No `interfaceDensity` setting** — `density`, `compact` (only p.130, of a ship), and
  `interface` all return no setting hits; no density/spacing/compact-mode discussion.
- **No audio or display-device settings** — `audio`, `sound option`, `music option`,
  `volume control`, `fullscreen`, `windowed`, `brightness`, and `colour blind`/`color
  blind` all return no setting hits (the manual's `sound`/`resolution`/`display` mentions
  are system requirements on p.8, and `contrast` on pp.28/55 is not a display control).
- **No `numberScale` / numeric-formatting option** — no scale, grouping, decimal, or
  abbreviation setting; the manual is silent on number formatting entirely.
- **No `language` / `formattingLocale` setting** — `language`, `locale`, and `english`
  return no setting hits; the manual is English-only and never separates UI language from
  number/date locale (consistent with `u-1-canonical-values.md` §5).
- **No `currencyDisplayMode`** — the manual never names or displays a currency symbol or
  unit; `currency`'s only hits are the *prestige* simile (pp.12, 61). The 1900-only
  "historical budgets" option (p.19) varies budget **values**, not currency units, and is
  outside 1880 scope (ADR-0201). Display-currency modes are Bluewave decisions
  (ADR-0206/0207/0211).
- **No `advisor`/advisor-message setting** — `advisor` returns no hits; `advice` appears
  only re: events (p.61).
- **No key-rebinding option** — hotkeys are fixed (pp.137-138).
- **No map-detail toggle named** — "more map options" (p.14) and "what is shown on the
  game map" (p.98) are referenced but never itemised.
- **Out of 1880 scope (manual-backed but for other starts)**: start years 1890/1900/1920/
  1935 (p.21), the 1900 manual legacy fleet (p.21), and the 1900 historical-budgets option
  (p.19) — the sole Bluewave start is 1880 (ADR-0201), so these must not be treated as
  reachable U-2 settings.

## 6. Using this note

- Ground a U-2 setting in the manual only where §3/§5 name it: measurement units (p.18),
  the nine save slots and autosave path (pp.22-23), realism levels (pp.98-99), report/
  map/auto-pause settings named but unenumerated (pp.88, 98), event pause and message-box
  customization (p.81), game speed (p.88), and floatplane launch method (p.119).
- Treat `theme`, `textScale`, `interfaceDensity`, `reducedMotion`, `tooltipDetail`,
  `numberScale`, `language`, `formattingLocale`, and `currencyDisplayMode` as **Bluewave
  presentation design** (ADR-0203/0202/0209/0206/0207/0211), not manual-backed; their
  presence in the domain must not be claimed as RTW3 terminology or behaviour.
- When the manual is silent, open a research note or a decision request rather than filling
  the gap by assumption (ADR-0210).

## Deferred

- **Autosave interval semantics: the manual says autosave during battles happens "at
  intervals according to preferences" (p.23) but never defines those intervals or their
  options.** If U-2 models an autosave cadence, its values need a Bluewave decision, not a
  manual citation. No owner assigned here.
- **Report-detail / map-display setting enumeration: the manual names the categories
  (p.98) but lists no individual toggles or defaults.** The concrete entries are Bluewave
  design and need their own authority if U-2 exposes them.
- **No decision request is needed for the remaining silence**: the manual's lack of a
  settings screen, theme, text-scale, reduced-motion, tooltip-detail, number-scale, locale,
  or currency-display setting is already covered by ADR-0203/0202/0209/0211 — a documented
  boundary, not an open decision. `docs/OPEN-ISSUES.md` is absent, so nothing there is
  affected.
