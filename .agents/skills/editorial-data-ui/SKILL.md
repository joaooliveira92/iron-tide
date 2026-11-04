---
name: editorial-data-ui
description: Design, implement, review, or redesign data-dense, status-driven screens in an editorial, evidence-first style (serif/sans pairing, hairline tables, small semantic status palette, state encoded by fill and pattern, progressive disclosure). Reuses the repository's existing design system first; never copies a reference screen.
disable-model-invocation: true
argument-hint: "Screen or component to design, redesign, or review"
---

# Editorial Data UI

## 1. Purpose and intended use

A reusable design language for interfaces that help a person read, compare, and monitor many values that change over time, while keeping the most important state visible at a glance.

It was inferred from three reference screens of a live election-results product. Those screens were **inspiration only**, not a specification, and this skill does not describe them. Everything below is a general system that must be re-expressed in the host application's own domain, content, and components.

Use it to create a new screen or modal, redesign an existing one, review an implementation, choose between layouts, validate UX/UI consistency, and translate design intent into frontend code.

### Evidence labels

- **[Observed]**: directly visible in the reference screens.
- **[Inferred]**: a cautious interpretation of observed patterns. Apply it unless host conventions conflict.
- **[Added]**: introduced to make the system production-ready. The reference did not show it.

## 2. Trigger conditions

Invoked by the user. Apply when the task involves:

- a screen, panel, table, list, card group, modal, drawer, or toolbar presenting many comparable values, statuses, or progress states;
- a request for an "editorial", "data-journalism", "results board", "live tracker", "scoreboard", or "dense but readable" feel;
- reviewing UI for hierarchy, density, status encoding, or consistency;
- choosing between a chart, a table, and a card layout for status-heavy content.

Do not use it to reproduce, trace, or pixel-match any screenshot or existing site, or to override a design system the repository already has. This skill sits **under** the repository's conventions (see §13, step 1).

## 3. Originality constraints (binding)

1. Preserve the broad mood: evidence-first, calm surfaces, strong typographic hierarchy, restrained color used for meaning. Do not clone the layout.
2. Do not recreate the reference's exact layout, copy, icons, illustrations, maps, gauges, branding, logo treatments, or distinctive assets.
3. Do not use the reference as a pixel target. No value in this file is a measurement taken from an image.
4. Adapt every decision to the application's own domain vocabulary, workflows, content hierarchy, and technical constraints.
5. The finished screen must be explainable from the application's own content needs. If a reviewer could mistake it for a news site's page, redesign it.

## 4. Design principles

| # | Principle | Evidence | Testable meaning |
|---|---|---|---|
| P1 | **Headline first, detail on demand.** One dominant statement of what is happening, then supporting data. | [Observed] large headline over small dated update lines; summary gauges over per-item tables | Each screen has exactly one largest/heaviest element. Detail rows never outrank it. |
| P2 | **State is encoded redundantly.** Status uses fill, text label, and a shape or pattern, never color alone. | [Observed] solid fill plus check mark for decided, hatching for in progress, pale tint for leaning, grey for no data | Every status can be told apart in greyscale. |
| P3 | **Color means something.** A small semantic palette; neutral otherwise. | [Observed] two opposing hues plus tints, grey neutrals, white ground | No decorative color. Every non-neutral hue maps to a named semantic role. |
| P4 | **Hairlines, not boxes.** Structure comes from thin dividers, whitespace, and alignment. | [Observed] thin rules between rows and sections; few filled panels | Prefer a rule or gap to a bordered card. Cards are for floating or interactive surfaces. |
| P5 | **Density with rhythm.** Many rows, but consistent row height and column alignment. | [Observed] multi-column tables with uniform row pitch | Dense is allowed only when rows are uniform and columns align. |
| P6 | **Uncertainty is visible.** Partial, pending, and missing data have their own treatment. | [Observed] em-dash for no value, hatching for partial, a "% in" progress column | No blank cell. Every empty value is a deliberate, labelled state. |
| P7 | **Progressive disclosure.** Show a bounded list, then "show all"; reveal detail on hover or focus and on explicit activation. | [Observed] "+ Show all", hover card with a mini table, "See full results ›" | Anything revealed by hover has a keyboard and touch equivalent. |
| P8 | **Freshness is first-class.** Time since last update sits near the content it qualifies. | [Observed] relative timestamps, a "live" marker | Live or changing content carries a marker and a timestamp. |
| P9 | **Source and caveat are quiet but present.** | [Observed] small footnote under a visualization | Any derived or sourced number has a footnote or explanation reachable from it. |

## 5. Visual language and design tokens

### 5.1 Token rule

All visual values come from **semantic tokens**, never raw literals in components. Where the repository already has tokens, map to them. Create a new token only when none fits, and name it by role, not value.

### 5.2 Token set (names are suggestions; adopt the host's naming)

**Surface**
- `surface-page`: the page ground. [Observed] near-white, flat.
- `surface-raised`: tooltips, popovers, banners. [Inferred] separated from the page by border or shadow, not a different hue.
- `surface-subtle`: faint tint for column highlights or zebra rows. [Observed]
- `surface-selected`: selected rows or segments.

**Border**
- `border-hairline`: row and section dividers. [Observed] 1px-class, low contrast.
- `border-strong`: control outlines. [Observed] heavier outline on the active segment of a toggle.
- `border-emphasis`: one promotional or critical callout only. [Observed] a gradient-bordered banner used once. Do not generalize it into a decorative border.

**Text**
- `text-primary`, `text-secondary` (metadata, timestamps, column headers), `text-tertiary` (footnotes, disabled), `text-link`, `text-on-status`.

**Status (semantic, not brand)**

Define each as a solid, a tint, and an on-color text token:
- `status-positive-a`, `status-positive-b`: two opposing or alternative categorical states. [Observed] two hues representing opposing sides. **Choose a pair from the application's own domain palette. Do not reuse red/blue unless the domain truly means two opposing sides.**
- `status-neutral`: undecided or unknown. [Observed] grey.
- `status-live`: the "happening now" marker. [Observed] small saturated uppercase label.
- `status-warning`, `status-danger`, `status-success`: [Added] for system feedback; the reference showed no error UI.

**Pattern tokens (not just colors)**
- `pattern-partial`: diagonal hatching for in-progress or partial data. [Observed]
- `pattern-changed`: a variant of the solid fill marking "changed from baseline". [Observed] hatching over a solid fill indicated a flip; [Inferred] the general concept is change versus baseline.

**Shape**
- `radius-none`/`radius-sm`/`radius-md`: [Observed] mostly square or very slightly rounded controls and chips. [Inferred] favor small radii; never pill-shape everything.
- `elevation-0` default (flat); `elevation-1` floating card. [Observed] a floating hover card had a soft shadow; the page surface was flat. No shadows on static content.

**Space and size**
- A consistent scale `space-1…space-8` from the host. The reference's exact values are unknown. The same step is used for the same relationship everywhere (§6.3).
- `row-height-compact`, `row-height-default`: one pair per application; a table uses one throughout.
- `control-height-sm/md`: a control's height does not vary within a toolbar.

**Motion**
- `motion-fast`, `motion-base`, plus a reduced-motion alternative. [Added] Durations come from the host.

### 5.3 Contrast on fills

Every `*-solid` status color meets 4.5:1 with its `text-on-status`, and every `*-tint` meets 4.5:1 with `text-primary`. Verify with a contrast tool, not by eye. [Added]

## 6. Layout and composition

### 6.1 Page structure

1. **Persistent compact header or section nav** with few top-level destinations and the current one clearly marked. [Observed] thin sticky bar with a bold active label. [Inferred] it does not grow on scroll.
2. **Summary band**: one or a few headline measures (gauge, big number, segmented progress bar) above per-item detail. [Observed]
3. **Primary region plus optional side rail** on wide viewports: the main visualization or table takes the larger share; a narrower rail carries secondary tracking, definitions, or updates. [Observed] Use the rail only when secondary content exists.
4. **Detail grids**: parallel columns of comparable lists, each with a subheading. [Observed] Use when one schema is partitioned into meaningful groups.
5. **Footnote/source line** under each visualization or table group. [Observed]

### 6.2 Grid behavior

- Gutters stay constant. [Inferred]
- A section's content aligns to the same edge as its heading.
- Numeric columns are right-aligned or decimal-aligned; text columns left-aligned; headers align with their data. [Alignment Observed; rule Added]
- Tabular (fixed-width) numerals in any column compared vertically. [Added]

### 6.3 Spacing rhythm

- [Inferred] Space within a group < space between rows' groups < space between sections. Each level is visibly larger than the previous, roughly ×1.5 to ×3, without measuring.
- Rows are separated by a hairline, not extra padding.
- No more than three distinct vertical gaps per screen outside component internals.

### 6.4 Composition choices

- Same attributes across many items: table with aligned columns.
- Proportion or progress toward a threshold: segmented or filled bar with the threshold marked, plus numbers in text. [Observed segmented progress boxes with "need N more"]
- A single headline measure with direction and confidence: a gauge or dial with the number and its uncertainty written out. [Observed] Skip the gauge if a number plus label communicates equally well.
- Spatial data: a map or diagram only if location is the point; otherwise a table.
- A feed of changes: reverse-chronological list; each item has a short linked label, one sentence, relative time, and optional source. [Observed]

## 7. Typography hierarchy

**Pairing** [Observed]: a high-contrast serif for headlines and section titles; a neutral sans for navigation, data, labels, body. [Inferred] the serif carries editorial authority, the sans carries data.

Map these roles onto the host's fonts. Use a serif only if the host already has one or the brand allows it; otherwise separate roles with weight and size.

| Role | Treatment | Rule |
|---|---|---|
| Display headline | Serif, bold, largest, tight leading | One per screen at most. |
| Section title | Serif or heavy sans, medium-large | Starts every major block. |
| Group heading | Sans, bold, small-medium | Labels a column group. |
| Body / description | Sans regular | Prose line length about 60-75 characters. [Added] |
| Table header | Sans, small, `text-secondary` | Never heavier than the data it labels. |
| Data value | Sans regular or medium, tabular numerals | Emphasis through weight or fill, not size. |
| Status label | Sans, very small, uppercase, letter-spaced | Inside chips only. [Observed] |
| Metadata / timestamp | Sans, small, `text-secondary` | Adjacent to what it describes. |
| Footnote | Sans, smallest, `text-tertiary` | At or above the minimum in §12. |

Rules:
- At most two families and four to five distinct sizes per screen.
- Adjacent roles differ by at least about 1.2× in size, or clearly in weight. [Added]
- Uppercase only for short labels (about 12 characters or fewer) with added letter-spacing, never sentences.
- Entity names in running text and tables are links, distinguishable without color (underline). [Underlines Observed; non-color affordance Added]

## 8. Color and contrast roles

1. **Neutral first.** The page is neutral; color appears only to encode status or identity.
2. **Two-tier emphasis** [Observed]:
   - Resolved/confirmed: solid fill, `text-on-status`, plus a check icon.
   - Probable/leaning: tint background, colored text, short uppercase label.
   - Unknown/pending: grey or hatched, never a saturated hue.
3. **Gradation, not new hues.** Express degrees of certainty or magnitude by lightness steps of the same hue. [Observed] Add steps only with at least three meaningful levels, and keep adjacent levels distinguishable.
4. **Colorblind safety** [Added]: the status hue pair differs in luminance as well as hue; a label, icon, or pattern accompanies every status.
5. **Links** use a dedicated `text-link` token plus underline, distinct from status hues so "clickable" is never confused with "status". [Inferred: the reference shared hues between links and status; do not copy that ambiguity.]
6. **Banners** may use the single `border-emphasis` treatment but never overlap content without a dismiss path and reserved scroll space.

## 9. Components and recurring patterns

Reuse existing host components first.

### 9.1 Section nav
- Few items, one clearly current, marked by weight and an underline or heavier text, not color alone. [Observed bold current item]
- Overflow goes into a menu with a chevron indicator. [Observed]

### 9.2 Segmented toggle
- For switching between two to four mutually exclusive views of the same data, not for navigation. [Observed two-segment toggle]
- Selected segment: heavier border/weight and `surface-selected`. Arrow keys move between segments. [Added]

### 9.3 Status chip
- Short uppercase label, small, tinted background or solid fill with `text-on-status`. [Observed]
- Fixed height and minimum width per set so chips in a column align. [Inferred]
- At most one state chip per row. The chip vocabulary is a closed set defined once per application.

### 9.4 Data table
- Header row, hairline dividers, uniform row height, aligned columns, em-dash for not-applicable or not-yet-available. [Observed]
- Optional emphasized cell: the value cell takes the status fill with a check icon when resolved; the fill covers the value cell only, not the row. [Observed]
- Optional muted progress column (for example "% complete"). [Observed]
- If sortable: direction icon and `aria-sort`. [Added]
- Truncated lists end with an inline "+ Show all" that expands in place and updates its label. [Observed]

### 9.5 Summary meter
- Compact graphic (dial, segmented bar, or number) paired with a label, a plain-language qualifier, and a small uppercase caption stating the basis or confidence. [Observed] The graphic is never the only carrier of the value.

### 9.6 Progress segments
- Equal discrete segments with filled count, threshold marked, and a sentence stating the remaining distance. [Observed] Only for naturally countable measures.

### 9.7 Hover/focus detail card
- Small elevated card anchored to the item: title, subtitle, compact table, progress footnote. [Observed]
- Opens on hover, keyboard focus, and tap; closes on Escape and outside click. Never the only route to the information. [Added]
- Does not cover its trigger and stays within the viewport.

### 9.8 Live feed item
- Linked entity label, one-sentence body, relative time, optional source, optional small thumbnail. [Observed]
- A "live" marker (short, saturated, uppercase) at the top of the updating region. [Observed] New items are announced politely to assistive tech.

### 9.9 Legend
- Under the visualization, ordered to match the encoding, one swatch per status including no data and not applicable. [Observed] Every pattern and fill in use has a legend entry.

### 9.10 Map or diagram controls
- Zoom in, zoom out, reset as stacked icon buttons in one bordered cluster, with a disabled state for unavailable actions. [Observed] Provide keyboard equivalents and a table alternative.

### 9.11 Sticky bottom banner
- Rare: one cross-cutting message with one primary action. [Observed]
- Dismissible, reserves bottom padding equal to its height, never traps focus. [Added]

### 9.12 Footnote and source
- Small text under a visualization stating source, basis of the numbers, and caveats, with an inline "read more" link. [Observed]

### 9.13 "See more" links
- Navigation to a deeper view is a text link with a trailing chevron. [Observed] Button styling is for actions that change state.

## 10. Interaction and state behavior

| State | Rule |
|---|---|
| Default | Flat, neutral, readable without interaction. |
| Hover | Subtle change: underline on links, light `surface-subtle` on rows, detail card for data items. Hover never reveals information reachable no other way. [Added] |
| Focus-visible | Clearly visible ring at 3:1 against adjacent colors, offset from the element, on every interactive element including linked table cells, acting chips, and map controls. [Added] |
| Active/selected | Heavier border or weight plus `surface-selected`, plus `aria-selected` or `aria-current`. |
| Disabled | Reduced contrast but still legible, with adjacent text or tooltip explaining why when not obvious. [Added] |
| Loading | Skeletons matching final row height and columns; for background refresh keep old data visible with a small "updating" indicator and timestamp. [Added] |
| Partial | Hatched fill or "in progress" label with a progress value. [Pattern Observed; behavior Added] |
| Empty | State what is absent, why (if known), and the next action. Em-dash in cells, never blank. |
| Error | Inline next to the failing region with a retry action. Replace the whole screen only if it cannot function. Keep last good data labelled stale. [Added] |
| Stale | Data older than the freshness threshold gets a warning token and text on its timestamp, not color alone. [Added] |
| Overflow | Long names truncate with ellipsis and a full-text title/tooltip; tables scroll inside their own region, never the page (§11). |

**Motion** [Added]: motion explains change (an item entering the feed, a segment filling), never decorates. Use `motion-fast` for state changes. Respect `prefers-reduced-motion` by replacing movement with instant or opacity changes. Do not animate layout of dense tables.

## 11. Responsive and adaptive behavior

Respond to **content pressure**, not device names. [Added; the reference showed only wide desktop layouts]

1. **Side rail**: when the main region would fall below the width at which its widest column set fits without wrapping, move the rail beneath the main region. [Inferred]
2. **Parallel column groups**: reduce columns per row before shrinking text; finally stack into one column of groups with sticky group headings.
3. **Tables**: drop the least important column first (declare an importance order per table), then convert rows to a two-line stacked layout, and only then allow horizontal scroll inside the table with a pinned first column.
4. **Section nav** collapses into a menu when items no longer fit on one line.
5. **Hover cards** become tap-to-open sheets or popovers on coarse pointers.
6. **Touch targets** are at least 44×44 CSS px (or the host's minimum) on coarse pointers; extend the hit area if the visible control is smaller.
7. **Maps/diagrams** keep legend and controls; default to the table alternative when the graphic is unreadable.
8. Typography scales by role; the headline may shrink more than table text, which stays legible.
9. Test at the narrowest and widest supported widths, 200% zoom, and the longest realistic labels.

## 12. Accessibility requirements

Treat as acceptance criteria. [Added unless noted]

- **Contrast**: text 4.5:1 (3:1 large); UI boundaries and focus indicators 3:1; verified on every status fill and tint.
- **Not color alone**: every status carries text, icon, or pattern. [P2 Observed]
- **Keyboard**: every interactive element reachable and operable in logical order; segmented toggles and menus use standard arrow-key patterns; Escape closes popovers; no keyboard traps.
- **Focus**: visible everywhere, never removed without replacement; returns to the trigger when an overlay closes; not hidden behind sticky bars (scroll padding equal to sticky height).
- **Semantics**: real `table`, `th scope`, `caption`; `nav` with `aria-current`; ordered headings with one `h1`; buttons for actions, links for navigation.
- **Graphics**: a text equivalent stating value, qualifier, and basis; a data-table alternative for maps and complex graphics.
- **Live regions**: `aria-live="polite"`, rate-limited, never steal focus.
- **Time**: relative times carry an absolute `datetime` available to assistive tech or on hover/focus.
- **Reduced motion**, and reflow at 400% zoom without loss of content.
- **Sticky overlays and banners** do not obscure focused elements and are dismissible.
- **Minimum text size**: the host's minimum, or 12 CSS px if none exists.

## 13. Implementation workflow for AI coding agents

1. **Inspect before inventing.** Search the repository for an existing design system, tokens, component library, theme files, layout primitives, agent instruction files (AGENTS.md, CLAUDE.md, package-level guides), and any guide for modals, dialogs, or screens. Reuse what exists. Introduce a new token or component only when none fits, and record why in the commit message or change description.
2. **Define the screen's job** in one sentence each: who uses it, the top decision it supports, the single headline element, and which data changes over time.
3. **Inventory the content.** List every datum with its type (category, magnitude, state, time), update frequency, and missing/partial/error forms.
4. **Choose structure** with §6.4. Sketch the region map (header, summary, main, rail, detail grids, footnote) before coding.
5. **Map to tokens** (§5). Create missing tokens by role name.
6. **Build bottom-up**: state vocabulary and chips, table and row, summary meter, cards/overlays, then page composition. Keep components generic; pass domain content via props or data.
7. **Implement every state** (§10) as you go: loading, empty, partial, error, stale, overflow, focus, disabled.
8. **Add accessibility** (§12) during construction: semantics, then keyboard, then live regions.
9. **Make it responsive** by content pressure (§11) and verify the extremes.
10. **Verify**: render the screen (use the repository's screenshot tooling if it has any), check greyscale legibility, contrast, keyboard path, narrow and wide widths, and long-label and zero-data fixtures.
11. **Review against §16 and satisfy §17.** Report any checklist item you could not verify.

## 14. Decision rules for ambiguous situations

- **Existing convention vs this skill**: the existing convention wins unless it breaks an accessibility requirement. In that case fix the accessibility issue minimally and note it.
- **Table vs cards**: table when users compare at least three attributes; cards only for heterogeneous items.
- **Chart vs number**: number plus qualifier unless the shape (trend, proportion, distribution) is the insight.
- **One more color?** No. Add a pattern, label, or lightness step first. Add a hue only for a new semantic meaning that exists in the domain.
- **Dense vs airy**: pick the density at which the most frequent task needs no scrolling or hovering. Comparison: compact rows. Reading: default rows. Never mix row heights in one table.
- **Hover vs inline detail**: inline when most users need it for most rows; otherwise hover/focus/tap detail with a keyboard route.
- **Modal vs inline vs drawer**: inline when the user keeps context while reading; drawer when they work beside the content; modal only for decisions that must be completed or dismissed first.
- **Uppercase**: only status chips and tiny captions.
- **Two things want to be loudest**: the one tied to the user's top decision wins; demote the other by weight, not by hiding it.
- **Missing data**: em-dash plus a way to learn why; never zero, never blank.
- **Unknown size/spacing value**: the host's nearest scale step, preserving the relationship within-group < between-group < between-section.
- **Promotional or system message**: one per screen, never between a heading and its data.

## 15. Anti-patterns and prohibited shortcuts

- Reproducing, tracing, or screenshot-matching any reference screen; copying its copy, icons, maps, gauges, or brand.
- Hardcoded hex values, pixel sizes, and shadows scattered in components.
- Status by color alone, or by two similar hues without label or pattern.
- Decorative gradients, shadows on static content, or glass effects as polish.
- Boxing every group in a card instead of hairlines and spacing.
- Mixed row heights or misaligned columns within one table.
- Blank cells, or `0`/`N/A` for "not yet known".
- Information available only on hover.
- Red/green or the reference's hue pair by default instead of domain-derived semantics.
- Screen-specific duplicates of chips, rows, or cards instead of shared components.
- Whole-page spinners for background refreshes.
- Truncation with no way to read the full value.
- Sticky elements that cover focus targets or content.
- Removing the focus outline without a replacement.
- Uppercase sentences, or more than two typeface families.
- Shipping only the happy-path state.
- Claiming a value came from the reference image.

## 16. UX/UI review checklist

Mark each pass, fail, or not applicable, with evidence.

**Hierarchy**
- [ ] Exactly one headline element dominates and supports the screen's top decision.
- [ ] Secondary data is lower in emphasis by size or weight, not by hiding.
- [ ] A new viewer can state the screen's main message within five seconds (test with a reviewer or screenshot).

**Tokens and consistency**
- [ ] No raw color, spacing, radius, or shadow literals in screen code.
- [ ] Existing components and tokens were reused; new ones are role-named and justified.
- [ ] The status vocabulary is a closed set used identically across screens.

**Layout**
- [ ] Columns align; headers align with data; numerics use tabular figures.
- [ ] Three or fewer distinct vertical gaps outside component internals.
- [ ] Within-group < between-group < between-section spacing holds.
- [ ] Rows have uniform height within each table.

**Status and data**
- [ ] Each status is distinguishable in greyscale.
- [ ] Every status and pattern has a legend or label.
- [ ] Empty, partial, pending, error, and stale values have explicit treatments.
- [ ] Freshness is shown where data changes.
- [ ] Sources and caveats exist for derived numbers.

**Interaction**
- [ ] All interactions are keyboard operable with visible focus.
- [ ] Hover content has focus and touch equivalents.
- [ ] Selected and current states are marked by more than color.
- [ ] Disabled controls explain why when not obvious.
- [ ] Loading preserves layout; background refresh keeps data visible.

**Responsive**
- [ ] Verified at narrowest and widest supported widths, at 200% zoom, and with long labels.
- [ ] Column drop order is defined; no page-level horizontal scroll.
- [ ] Touch targets meet the minimum.

**Accessibility**
- [ ] Contrast verified for text, UI, focus, and every status fill.
- [ ] Table, heading, and landmark semantics are correct; graphics have text alternatives.
- [ ] Live updates are polite and do not move focus.
- [ ] Reduced motion is respected.

**Originality**
- [ ] Layout, wording, icons, and assets derive from this application's domain, not the reference.
- [ ] No element exists only because the reference had it.

## 17. Definition of done

1. §16 is completed with no unexplained failures; unverified items are listed explicitly.
2. The repository's own checks (lint, type-check, tests, any required visual or screenshot verification) pass.
3. Every state in §10 is demonstrable with fixtures (zero, one, many, long labels, partial, error, stale).
4. Keyboard-only traversal of the full screen was performed and works.
5. Contrast and greyscale checks were performed on status styling.
6. Responsive checks at the extremes were performed.
7. New tokens and components are role-named, reusable, and documented where the repository documents such things.
8. The change description states which patterns were used, which were deliberately not used, and any deviation from this skill with its reason.
9. A reviewer comparing the screen to any known reference site finds shared principles, not shared layout, content, or assets.

## 18. Examples (applications of the principles, not copies)

**A. Logistics fleet readiness board**
- Headline: one serif statement of overall readiness ("14 of 20 vessels ready") with a segmented bar marking the required threshold and a sentence stating the remaining gap.
- Main: a table of vessels. The readiness cell is solid-filled with a check when certified, tinted with a "LIKELY" chip when pending inspection, hatched during refit, and an em-dash when unreported.
- Rail: a feed of status changes with relative times and a polite live region.
- Footnote: how readiness is computed, with a link to the method.
- Status hues come from the domain ("available" vs "committed"), not red/blue by default.

**B. Research-progress tracker**
- Parallel columns grouped by project phase, each a table sharing one schema. A segmented toggle switches between "by team" and "by milestone" over the same data.
- Row hover or focus opens a small card with a mini table of recent results and the share of data collected; the same content opens in a sheet on touch.
- Narrow widths: columns stack and the least important column drops first per the declared order.

**C. Reviewing an existing settings-heavy screen**
- The agent finds three card styles and mixed row heights. It replaces boxed groups with hairline-separated sections, unifies on one row height, introduces role-named tokens for the status chips already present, and adds missing empty and error states. It does not restyle controls the design system already provides.

**D. Choosing between alternatives**
- A team proposes a gauge for "budget used". Under §14 the number plus a segmented bar with the threshold marked conveys proportion and remaining distance and is accessible by default, so the gauge is rejected unless a trend or confidence band is the insight.
