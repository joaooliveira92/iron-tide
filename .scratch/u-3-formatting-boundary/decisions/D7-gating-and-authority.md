# D7: Gating, authority, dependencies, and the national-currency content decision

**Type:** grilling · **Status:** resolved

## Question

What authority governs U-3, what does it depend on, is it gated, and does it
introduce a stop condition?

## Answer

**Authority.** ADR-0202 (canonical values, presentation-only), ADR-0209 (language
vs locale), ADR-0206/0207/0208/0211 (currency display modes, default,
requested/effective), and the U-1 acceptance ADRs ADR-0215/0216/0217/0218
(canonical table, money/treasury bridge, rounding/float gate, conversion/locale
boundary). The manual is authority 3 and grounds only the imperial measurement
default (p.18); it is silent on formatting, rounding, locale and currency
(`docs/research/u-1-canonical-values.md` §5). Authority order per ADR-0210.

**Dependencies.** U-3 consumes U-2's preferences domain (implemented on `dev`:
the effect-free `preferences-contract.ts`, the main store/bridge, the preload
capability and the renderer selectors, including `CurrencyFallbackReason`,
`NationalCurrencyAvailability`, `resolveEffectiveCurrencyDisplayMode`) and U-1's
canonical table and `Money` type. It stores nothing authoritative and changes no
authoritative outcome: it is **golden-neutral** and requires no re-pin.

**National-currency content is a separate decision, not a U-3 deliverable.**
ADR-0211 requires a validated per-nation configuration before National Historical
is selectable, and the manual cannot ground it (`docs/research/u-1-canonical-values.md`
Deferred): the data needs an owner and **primary historical sources** (national
finance/statistics works). U-3 ships the **schema and production validation** with
fixtures; it ships **no production configurations** and therefore leaves National
Historical unavailable with reason `nationalCurrencyNotConfigured`. Authoring the
configurations is a decision request for the owner (recommended: a new
`.ai/decision-requests/00xx-national-currency-configurations.md`), scoped to U-3
content or a later sprint — **not** resolved here, and **not** invented.

**No gate on the boundary work.** U-3's formatters, conversion module, availability
resolution, gate and leak removal are ungated; they change no authoritative value.

**Stop condition.** If implementing a formatter would require changing an
authoritative value, a save or wire format, or a golden hash — or would require
inventing historical currency data the manual and primary sources do not supply —
**stop** and raise a decision request rather than resolving it in U-3.

## Why

Determinism, compatibility and canonical-content decisions must not be made
silently (AGENTS.md Stop conditions; contract §ADR threshold). Recording that U-3
is authority-bound, dependent on U-2/U-1, golden-neutral, ungated, and that the
national-currency data is an owner decision keeps the way to implementation
unambiguous and stops U-3 from fabricating canonical content.
