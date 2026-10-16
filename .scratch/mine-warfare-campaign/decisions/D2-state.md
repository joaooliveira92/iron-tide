# D2: State

**Type:** grilling · **Status:** resolved

## Question
Where does mine pressure live?

## Answer
A required collection of area mine-pressure records (the existing engine record
shape, with its hash) in the campaign snapshot, ordered by area id, empty at
compile in 1880 (no pre-seeded fields: the manual's pre-war small minefields are
a battle-generation concern, deferred). Introduced under the compatibility-version
bump; hash change re-pinned with cause "new mine pressure state".

## Why
Pressure must persist across months and saves to decay and be swept; deriving it
per month would discard history the engine's decay and freshness contracts need.
