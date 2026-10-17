# D5: Final score and Hall of Fame

**Type:** grilling · **Status:** resolved

## Question

How much of "final score, Hall of Fame" does S-2 deliver?

## Answer

S-2 produces a **career result** (nation, final score, end reason SACKED or
HORIZON_REACHED, month) from authoritative state when a career ends. The manual
says prestige at the end is the score, so the score is the nation's prestige
at that moment; any additional scoring formula would be a D6 value. The Hall of
Fame list (persisting results across campaigns, a screen) is out of scope: it
needs the profile persistence of U-2 and belongs to a later sprint.

## Why

The career result is authoritative campaign state; the Hall of Fame is a
cross-campaign presentation store and must not enter authoritative hashes.
