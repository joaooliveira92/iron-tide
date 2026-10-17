# D1: Scope boundary

**Type:** grilling · **Status:** resolved

## Question

Which parts of "budget pressure and unrest" does S-3 own, given several drivers
(events, social programmes, trade war) belong to sprints that do not exist yet?

## Answer

S-3 owns the unrest mechanism end to end and every driver whose cause the engine
already records: naval spending share, war outbreak and duration, blockade, battle
and war defeats and victories, and cramped accommodation. Events and social
programmes are named seams (reason codes reserved, no source). The economy half of
the sprint is growth, colony income and decay, and the research cap.

## Why

The sprint acceptance names drivers and brakes "per p.62". A driver with no
observable cause cannot pass the gate criterion (a deterministic test drives it from
a compiled campaign month). Reserving the reason codes lets S-4 and W-1 plug in
without new arithmetic.
