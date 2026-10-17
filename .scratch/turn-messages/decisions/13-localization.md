# D-13: Localization catalogue ownership & fallback (ADR-0209)

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Who owns message text and how does fallback work under ADR-0209?

## Answer

Messages carry `titleKey` / `bodyKey` / `interpolation` (engine side). The
**en-US catalogue is authored, compiled content** (versioned/hashed like other
content) and resolved in the renderer, so the projection package stays
runtime-free and never embeds player-facing prose. **Fallback:** missing
translation → en-US; missing key entirely → development warning + safe generic
fallback, **never** a raw key in production; formatting locale independent of
language (ADR-0209/0218).

(Locked round 3.)

## Consequence

Consumed by D-14 (DTO keys), D-15 (renderer resolution), D-16 (catalogue path).
Grounded by R-23.
