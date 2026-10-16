# D1: Scope boundary

**Type:** grilling · **Status:** resolved

## Question

What does U-2 own, and where does it hand off to U-3 (formatting boundary) and U-4
(Options screen)?

## Answer

U-2 owns, in the desktop application (not the authoritative game domain):

- the **versioned preferences schema** and its central defaults, with strict
  validation of every value;
- **deterministic migration** from the settings as they are stored today
  (renderer `localStorage` keys and the campaign display-preference key) into the
  versioned domain;
- the **scope model** — app, campaign, and session scopes and their resolution
  precedence (D3);
- **atomic main-process persistence** of app-scope and campaign-scope preferences;
- the **narrow preload capability** and typed renderer selectors (D6);
- the **requested-vs-effective currency-display-mode model** — storing the
  request and modelling the derived effective mode (D5), without implementing the
  availability rules;
- the **renderer-contract parity** between the shared, effect-free view type and
  the strict schema.

U-2 explicitly does **not** build:

- the central **formatters and parsers** (measurement, money in NC/BP/national
  historical, numbers, dates) or the currency-mode **availability/resolution**
  logic and its reason codes — **U-3**;
- the **Options screen** sections, live preview, reset controls, and externalized
  strings — **U-4**;
- **presentation-invariance and round-trip tests** across currency modes and
  presets — **U-5**;
- **per-nation National Historical currency configuration content** — U-3 content
  work (needs an owner and primary sources);
- the **campaign-start options** (research speed, varied technologies, historical
  budgets, legacy-fleet build): these are new-game configuration compiled into the
  campaign, not user preferences (manual p.19/21);
- **autosave slot count/cadence** and save-slot UI — **F-4** (manual pp.22-23);
- **tactical-battle preferences** (realism levels, report detail, map display,
  auto-pause events, game speed) — **T-2** (manual pp.81/88/98-99).

## Why

ADR-0203 assigns the preferences architecture to U-2, the formatting boundary to
U-3, and the Options screen to U-4, and ADR-0202 makes units/currency
presentation-only over canonical values. Drawing the line at the domain — schema,
defaults, migration, persistence, scopes, capability, selectors — keeps U-2 free
of formatting and UI, and keeps the runtime-free renderer (no `effect`) intact.
U-3/U-4/U-5 then consume, rather than redefine, what U-2 fixes.

The existing renderer settings (theme, background, font, interface density) and
the campaign display preferences are **migrated into the domain by U-2** so there
is a single source of truth; U-2 rewires those existing controls, but does not
rebuild the Options screen (U-4).
