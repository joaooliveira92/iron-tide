# D5: Migration, corruption recovery, and requested/effective currency

**Type:** grilling · **Status:** resolved

## Question

How are the settings that exist today migrated into the versioned domain, what
happens when a stored file is corrupt or holds unknown values, and how is the
currency-display request kept distinct from the effective mode?

## Answer

**Deterministic migration.** A version constant stamps every stored preferences
file. Migration is a pure, ordered list of steps from each prior version to the
current one; it reads the settings as they are stored today
(`bluewave-theme`, `bluewave-density`, `bluewave-font`, `bluewave-background`,
`bluewave-display-preferences`) and produces the versioned app/campaign-scope
values, preserving valid values and filling missing ones from the central
defaults. Migration is idempotent and total: any unknown legacy value becomes the
default for that key. The first migration is `0 → 1` (the implicit
`localStorage`-era format).

**Corruption and unknown values recover without touching saves.** A corrupt or
undecodable preferences file, or an unknown/out-of-range value, recovers to the
central defaults (per key where possible, else per file) with a logged diagnostic;
it never fails startup, never rewrites a save, and never throws into the renderer.
Recovery is explicit and logged, distinct from validation (contract §Compiler:
validation, normalization, and repair stay distinct).

**Requested vs effective currency.** The domain stores
`currencyDisplayMode` as the **request** and exposes it unchanged. The
**effective** mode is derived runtime state: with no active campaign, or an
unsupported/misconfigured nation, the effective mode falls back to `navalCredits`
with a reason code (`noActiveNation`, `nationalCurrencyNotConfigured`,
`nationalCurrencyInvalid`, `nationalCurrencyOutsideSupportedPeriod`). The request
is never rewritten by a fallback and is restored when a supported campaign is
active (ADR-0211). U-2 **models** the request and the derived-effective field;
U-3 implements the availability rules, the reason-code mapping to localized
messages, and the render fallback.

## Why

ADR-0203 requires "central defaults, deterministic migration, atomic
main-process persistence" and "corrupt or unknown settings recover without
touching saves". ADR-0211 requires requested and effective modes to be modelled
separately and the request preserved across campaigns. Deterministic (pure,
ordered, total) migration is required so the same legacy state always migrates to
the same preferences state. Recovery is logged and narrow, and never touches
authoritative data (D7).
