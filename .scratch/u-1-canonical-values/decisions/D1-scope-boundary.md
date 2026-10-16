# D1: Scope boundary

**Type:** grilling · **Status:** resolved

## Question

What does U-1 own, and where does it hand off to U-2 (preferences), U-3
(formatting boundary) and U-4 (Options screen)?

## Answer

U-1 owns, in authoritative packages:

- the **canonical unit table** — one declaration of the canonical internal unit
  per quantity and the branded types that carry it (D2);
- the **fixed-precision money representation** — one branded integer money type
  and the fields it brands (D3);
- the **rounding and fixed-point rules** and the helpers that implement them
  (D4);
- the **conversion/locale boundary definition** — where canonical↔display
  conversion may occur and the separation of UI language from formatting locale
  (D6);
- the **authoritative float and display-leakage audit** and its remediation
  tickets (D5).

U-1 explicitly does **not** build:

- the preferences domain, its schema, persistence or scopes — **U-2**;
- the central formatters/parsers, the currency-mode rendering and the Options
  screen — **U-3/U-4**;
- presentation-invariance and round-trip tests across modes — **U-5**;
- per-nation National Historical currency configuration content — **U-3**
  (the research note flags it as needing an owner and primary sources).

## Why

ADR-0202 defers "a canonical unit table and fixed-precision monetary
representation" to U-1 and "the formatting boundary" to U-3. Drawing the line at
the representation/boundary definition keeps U-1 free of presentation code and
keeps the runtime-free renderer gate intact; U-2/U-3 then consume, rather than
redefine, what U-1 fixes.
