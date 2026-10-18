# D5: Revolution

**Type:** grilling · **Status:** resolved

## Question

How does a high unrest level lose a war, and how is "less likely in liberal
democracies" expressed deterministically?

## Answer

Only a nation at war and at or above the revolution threshold is eligible. Each month
a domain-separated seeded draw (stream identity, nation key, phase, ruleset version,
input hash recorded) decides revolution; liberal democracy scales the probability by
a ruleset factor below one. A revolution ends the nation's side of the war as a loss
through the existing peace-settlement path with a ruleset severity multiplier for
"unusually harsh conditions" (p.78), and may change the government type. The sacking
rule of S-2 applies only to the player and is not touched.

## Why

p.62 and p.78 give the qualitative rule. A seeded draw follows the determinism
contract; reusing the settlement path avoids a second war-ending mechanism.
