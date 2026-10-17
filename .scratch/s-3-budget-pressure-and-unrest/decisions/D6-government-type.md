# D6: Government type

**Type:** grilling · **Status:** resolved (classification escalated, 0011)

## Question

Revolution damping needs the manual's government type (p.60), which no state field
carries. Where does it come from?

## Answer

State carries one of the six manual types (liberal democracy, limited democracy,
autocratic, fascist, communist, eastern). It is derived at compile time from the
already authored 1880 political system through a ruleset mapping table. An unmapped
political system is a compile diagnostic, never a default. Only the damping consumer
exists in S-3; event gating is S-4.

## Why

Content already authors `politicalSystem`; deriving avoids a second source of truth
(never dual-maintain). Which 1880 systems map to which manual type is a gameplay
classification the manual does not give for 1880, so the production mapping is
escalated (0011).
