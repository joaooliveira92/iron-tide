# 11: Decide the canonical naval penetration model

**Type:** decision

**What to build:** The armour-penetration capability is a linear placeholder
("armor_v1 preliminary") whose projectile-mass input is silently ignored; the
surrounding comment promises a "more sophisticated model in a later ticket" that
does not exist. Produce a recorded decision selecting the canonical model (and
its inputs), grounded in high-trust naval sources, or explicitly defer it to an
owned effort. This changes authoritative combat outcomes, so it needs a
decision/ADR rather than a silent edit.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] A decision is recorded (ADR or decision note) selecting the penetration model and its inputs, with grounded sources, or explicitly deferring it with an owner.
- [x] The fate of the ignored mass input is stated.
- [x] The authoritative-outcome impact is identified; any golden hash change has an understood cause.

## Answer

**Decision: defer replacing the preliminary formula; keep the current
deterministic linear model.**

- Selecting a canonical naval penetration model changes authoritative combat
  outcomes, so it must be grounded in high-trust sources and validated against
  the full armour/penetration feature set. No such spec exists yet, and authoring
  a model here would fabricate canonical content (an AGENTS stop condition).
- The ignored projectile-mass input stays ignored for now: the placeholder is
  `floor(caliber × velocity / 1000)` and mass is deliberately unused.
- Authoritative-outcome impact: any future replacement will change penetration
  outcomes and therefore goldens; that change must carry its own understood cause
  in the replacing ticket, not here.

**Owner:** the armour/penetration subsystem, via a future DESIGN/spec for combat
armour. That spec replaces the placeholder formula and its comment together.
