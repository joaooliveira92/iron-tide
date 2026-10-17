# D3: Capability source

**Type:** grilling · **Status:** resolved

## Question
How does a ship become a mine layer or sweeper in the campaign?

## Answer
At design compile time a version's mine-laying and sweeping contributions are
derived from its MINE_GEAR components and ship type (sweeping-eligible types per
the engine's eligibility contract) and stored on the immutable compiled design
version, so later content edits cannot change behaviour (same discipline as
compiled armament). Ships inherit it through their design version; authored
1880 starting ships without a modelled design contribute nothing and that is
stated, not repaired.

## Why
The campaign ship record has no equipment. Reading the design at month time would
make results depend on mutable content.
