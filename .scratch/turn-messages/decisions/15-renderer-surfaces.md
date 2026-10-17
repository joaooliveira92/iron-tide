# D-15: Renderer surfaces

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

What surfaces does the renderer need, and how is authoritative state kept out?

## Answer

- **Summary panel** grouped by category/severity with filters (All / Critical /
  Decisions / Diplomacy / War / Battles / Ships / Construction / Research /
  Intelligence / Finance / Warnings), expandable detail, entity links, pin/read
  state in `ui-state.json` (**never deletes events**).
- **Blocking decision modal** with qualitative consequence hints; Continue disabled
  while unresolved.
- **Battle-request modal** surfacing T-1's request (accept/decline/delegate).
- **Campaign-log history** over `turn-summaries.json`; historical entities open
  **read-only** records.
- **Recovery prompt** on load with a pending turn, plus a clean
  "resumption unavailable" path that leaves the save untouched.

The renderer holds no authoritative state: it renders validated DTOs and submits
decisions as validated commands (D-14).

(Locked round 3.)

## Consequence

Consumed by D-14, D-19. Detail is fog ("Not yet specified") pending a possible
`prototype` ticket.
