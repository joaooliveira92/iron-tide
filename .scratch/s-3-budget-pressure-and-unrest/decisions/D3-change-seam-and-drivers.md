# D3: One change seam, closed reasons, monthly drivers

**Type:** grilling · **Status:** resolved

## Question

How do many drivers move one number without each inventing arithmetic?

## Answer

One operation changes a nation's unrest by reason code, with checked integer
arithmetic, bounds, and a domain event carrying before, after, reason and ruleset
version. The reason vocabulary is closed and exported: `MILITARY_SPENDING`,
`SPENDING_CUT`, `WAR_OUTBREAK`, `WAR_DURATION`, `BLOCKADE`, `DEFEAT`, `VICTORY`,
`CRAMPED_ACCOMMODATION`, plus reserved `EVENT` and `SOCIAL_PROGRAMME` with no
source yet. Drivers are evaluated in one dedicated monthly phase placed after battle
resolution so the month's defeats and victories count, and before the next revenue
so a brake bites the next appropriation. War outbreak lowers unrest initially;
duration reverses the sign past a ruleset threshold (manual p.62).

## Why

Mirrors the S-2 prestige seam (one seam, auditable by reason). Phase order follows
the existing pipeline where `monthly_revenue` runs first each month.
