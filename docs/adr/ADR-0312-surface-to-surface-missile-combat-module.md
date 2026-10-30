# ADR-0312: Surface-to-surface missile salvos are a deterministic combat module

Applies to: combat, content

## Status

Superseded by: ADR-0358

Accepted (2026-10-26) for [#293](https://github.com/joaooliveira92/iron-tide/issues/293), part of
[#281](https://github.com/joaooliveira92/iron-tide/issues/281) under
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Applies the capability seam of
[ADR-0308](ADR-0308-e1-compiled-design-capabilities-reach-combat.md), the family vocabulary of
[ADR-0309](ADR-0309-e1-part-families-and-capability-kinds.md), and the balance-target policy of
[ADR-0283](ADR-0283-e1-1940-1970-content-decisions.md).

## Context

The manual (pp.121-123) names Light, Medium and Heavy surface-to-surface and air-to-surface missile
families, but the engine had no missile combat model. Missile launchers could be authored as a part
family and a `missile_launch` capability could reach a compiled design, yet nothing consumed it.
Surface-to-surface missiles are the first slice; SAM, ASM, cruise and special missiles remain
separate follow-ups.

## Decision

1. **One new authoritative module.** `packages/combat/src/missiles` owns the SSM contract,
   launcher and in-flight state, projection, records, ordering, reason codes and resolution. It
   mirrors the mines and torpedoes modules: safe integers, canonical ordering, strict record
   surfaces, and SHA-256 envelopes for every hashed record.
2. **Scope is SSM only.** The module recognises `light_ssm`, `medium_ssm` and `heavy_ssm`. A
   `missile_launch` capability carrying `sam` or `asm` is ignored for now; those classes keep the
   schema vocabulary and remain dormant. No SAM, ASM, cruise or special missile behaviour is added.
3. **Eligibility is the carried capability, not a hidden rule.** A design with a `missile_launch`
   capability projects a launcher; a design without one projects none. `salvoSize`,
   `maxSalvosPerBattle`, range and warhead values come from the class rules, and duplicate
   launchers of one class multiply the salvo budget.
4. **One authored ruleset block.** `rulesets.yaml` gains a `missiles` section with a per-class
   `rangeM`, `flightTimeSeconds`, `salvoSize`, `baseHitBp`, `structuralDamage`, `flotationDamage`,
   `defenceInterceptBp` and `maxSalvosPerBattle`. The block is optional: a pack without it leaves
   the module dormant. The values are `BALANCE_TARGET` with provenance citing the manual
   (pp.121-123) and ADR-0283 D2/D5; no constant is hidden in code.
5. **Resolution is keyed and recorded.** Interception and per-missile hit checks draw from
   domain-separated streams. Every draw is written to the `RandomLedger` with stream id, entity
   key, phase, ruleset version, input hash, draw, outcome and reason code. Launch, intercept, hit
   and miss records carry their own hashed envelope.
6. **Flight time is explicit state.** A salvo launches at minute N and impacts at
   `N + ceil(flightTimeSeconds / 60)`. Arriving and in-flight salvos are canonically sorted, so the
   same seed produces the same records and minute hashes.
7. **Damage reuses the existing model.** A hit produces a `GunneryImpact` from the class warhead
   values and is applied through `resolveDamage` in the minute damage stage. Missiles do not add a
   parallel damage system.
8. **The rules are threaded, not read ad hoc.** `missilesRules` is an optional member of
   `MonthExecutorEngineOptions`, decoded once from the content bundle at the desktop boundary and
   passed to the auto resolver, the player-battle projection and the tactical replay verifier. A
   caller without it gets today's exact behaviour.
9. **Three launcher parts are authored.** `ship-building/parts/missile_launcher.yaml` adds light,
   medium and heavy launchers with the `missile_launch` capability and a missile-launcher slot
   template on every hull form. All three parts require the existing `mis_heavy_ssm` technology
   (1947); no new technology id is authored, so the world technology list and every replay
   checkpoint stay byte-identical. The alternative of adding `mis_light_ssm` and `mis_medium_ssm`
   at 1955 was rejected for this slice because a new catalogue technology moves the initial
   campaign snapshot and therefore every replay checkpoint, which the issue forbids. Part dates and
   values remain ADR-0283 D2/D5 balance targets.

## Compatibility

Additive and optional on every persisted and content surface; the save compatibility version stays
4.0.0. No 1880 production design carries a missile launcher, so no replay checkpoint or golden hash
moves for a design without one. No new technology id is added, so the world technology list is
unchanged. The content hash moves because the ruleset, parts, slot template and platform files
change; the content lock and replay content hash are refreshed as a content change, not a gameplay
change. A design that carries a launcher moves its own compiled hash, as ADR-0308 already decided.

## Consequences

- A campaign battle can observe a missile launch, intercept and hit through the auto resolver and
  the player battle loop when its designs carry a launcher.
- No production reference design carries a launcher yet, so the reachability ledger records
  `combat-missiles` as `dormant-by-decision` with #258 as the content owner.
- SAM, ASM, cruise and special missiles remain out of scope and need their own ADR and models.
- Retuning the ruleset is a ruleset version change with replay re-approval.

## Alternatives rejected

- **Reuse gunnery batteries.** Missile range, flight time, salvo budget and interception are not
  gun mechanics; folding them into gunnery would hide a new authoritative surface inside an old
  contract.
- **Resolve missiles during projection.** Flight time and per-minute interception need state that
  survives the minute loop.
- **Add SAM and ASM in the same slice.** Their launch platforms, guidance and defence interactions
  differ; the ticket explicitly separates them.
