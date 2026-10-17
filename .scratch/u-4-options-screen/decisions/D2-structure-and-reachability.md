# D2: Screen structure and reachability

**Type:** grilling · **Status:** resolved

## Question

How is the Options screen structured, and how is it reachable from both the main
menu and a campaign?

## Answer

**Sections.** The screen is one page with the seven ADR-0203 sections — General,
Appearance, Measurements, Currency and Numbers, Gameplay Interface, Accessibility,
Advanced — navigable within the screen; it is a single `options` screen in the
`settings` group, not seven registry screens.

**Reachability.** Options must be reachable **before a campaign and inside one**.
Today `CampaignScreenOutlet` renders only when a campaign is open, so U-4 adds a
pre-campaign entry point (a control on the main menu / `CampaignFileScreen` and the
pre-campaign shell) that opens the same screen, and keeps the in-campaign
settings-group route. The screen reads app-scope preferences, so it works with no
active campaign; campaign-dependent controls (currency availability) degrade
honestly to their no-campaign state (D5).

## Why

The U-2 acceptance already requires settings to be changeable before a campaign,
and the sprint row requires U-4 "reachable from main menu and campaign". The screen
itself depends only on app-scope preferences and U-3 formatters, so the only work
is the navigation surface, not a second screen.
