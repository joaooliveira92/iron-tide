# 02: Localized message catalogue and renderer resolver

**What to build:** Message text is authored as compiled content and resolved in the renderer, so the projection package never embeds prose. An en-US catalogue ships as a compiled content artifact; a renderer-side resolver maps a message's title/body keys (with interpolation) to en-US text, exactly as other presentation content is delivered today. A missing translation falls back to en-US; a missing key produces a development warning and a safe generic fallback — never a raw key in production (ADR-0209). Text language and number/date formatting locale stay independent (ADR-0218).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The en-US catalogue is authored, declared in the content pack, compiled, and delivered to the renderer like existing presentation content.
- [ ] Every key the projection emits resolves to en-US text on the client.
- [ ] A missing translation falls back to en-US; a missing key warns in development and renders a safe fallback, never the raw key.
- [ ] UI language and formatting locale are independent; message text does not change when only the formatting locale changes.
- [ ] Tests cover key coverage, fallback behaviour, and the language/locale separation.
