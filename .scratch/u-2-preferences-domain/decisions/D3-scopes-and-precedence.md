# D3: Scope model and resolution precedence

**Type:** grilling · **Status:** resolved

## Question

What does app, campaign, and session scope each hold, where is each stored, and
how do they resolve?

## Answer

Three scopes, each with one storage home and one resolution order.

- **App scope** — presentation that follows the player across every campaign:
  `theme`, `background`, `font`, `textScale`, `interfaceDensity`,
  `reducedMotion`, `language`, `formattingLocale`, `measurementPreset` (and any
  per-category custom measurement selections), `numberScale`, `tooltipDetail`,
  and the stored `currencyDisplayMode` **request**. Stored in one app-scope JSON
  file in the application data directory (atomic write).
- **Campaign scope** — display choices that are per-campaign and reboot the
  player's view of that campaign: the existing display preferences
  (`showDetailedTooltips`, `confirmBeforeTurn`, `showUnitFatigue`,
  `showSupplyOverlay`) plus any future per-campaign override. Stored under the
  campaign package directory beside the existing campaign sidecars, keyed by
  location, never inside the hashed save snapshot.
- **Session scope** — ephemeral, in-memory only, dropped when the session closes:
  a transient override or the current tactical-view preference. Never written to
  disk.

**Resolution:** `effective(key) = session ?? campaign ?? app ?? default`, computed
at read time. Writing a value is explicit about its scope; a session value never
persists and never rewrites the app value. The **requested** currency mode is
app-scope and preserved across campaigns (ADR-0211); the **effective** currency
mode is derived runtime state (D5), not a stored preference.

## Why

ADR-0203 names app, campaign, and session scopes but not their contents.
Classifying by "does this follow the player or the campaign?" gives one home per
scope and one precedence rule, and matches the storage split that already exists
(renderer app-scope `localStorage` and per-campaign sidecar files). Keeping
campaign-scope preferences in sidecars — not in the save — is required because
preferences must never change an authoritative hash (D7).
