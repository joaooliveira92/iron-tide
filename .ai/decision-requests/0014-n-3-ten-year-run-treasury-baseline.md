# Decision Request: N-3 ten-year run — the command-free decade is insolvent for every nation

## Status

Resolved 2026-10-17: Option A accepted; Option C tracked as #95. Created 2026-10-17. Gates **N-3 ticket 03 (#50)**
and, through it, tickets 04 (#51) and 06 (#53). Ticket 01 (#48) and ticket 05
(#52) are complete; ticket 02 (#49) is complete.

## Trigger

Spec #47 R5 and ticket #50 say: "Only the known S-1 Portugal/Netherlands treasury
baseline is allowlisted, and only if it reproduces identically; any other failure
stops the ticket with a decision request instead of an allowlist entry."

The N-3 120-month command-free run was implemented as
`production-ten-year` in `packages/cross-process-test/src/run-child.ts`. On the
committed production pack it **reproduces identically** (two in-process passes
and two fresh processes agree on every checkpoint and the closing hash), but it
records `NEGATIVE_TREASURY_OBLIGATION` for **all fourteen nations**, not only
Portugal and the Netherlands. The first new failure is Qing at month 13.

## Evidence

### E1. Observed diagnostics over 120 months

From one `production-ten-year` run (deterministic output; the same run was
repeated and byte-matched):

| Nation          | Months with `NEGATIVE_TREASURY_OBLIGATION` | First month |
| --------------- | ------------------------------------------ | ----------- |
| portugal        | 110                                        | 11          |
| netherlands     | 109                                        | 12          |
| qing            | 108                                        | 13          |
| austria_hungary | 104                                        | 17          |
| germany         | 103                                        | 18          |
| france          | 102                                        | 19          |
| italy           | 103                                        | 18          |
| japan           | 102                                        | 19          |
| ottoman_empire  | 102                                        | 19          |
| russia          | 102                                        | 19          |
| spain           | 102                                        | 19          |
| uk              | 102                                        | 19          |
| brazil          | 100                                        | 21          |
| usa             | 97                                         | 24          |

The table is a summary of the run's diagnostic list; the exact per-month
sequence is in the run output. Every diagnostic has the same code and message
(`Nation <id> would have negative treasury after obligation`). No other
diagnostic code appears.

### E2. Reproduction and determinism

- `inProcessRepeatMatches: true` (two in-process passes over the same compiled
  start agree on monthly hashes, closing hash and diagnostics).
- Two fresh child processes produced byte-identical stdout (the test compares
  the whole JSON, including all 120 monthly hashes and all diagnostics).
- Yearly checkpoints (1880–1889) and the 1890-01 closing hash are stable
  (`f54d498186c568a170fdd0ed868558c1ffb0dfdadbd8922414c60acde19c3d17` at the
  time of writing; the value is evidence, not a new pinned golden).

### E3. Why the long run differs from N-2's twelve-month smoke

N-2's smoke run is twelve months and reaches only the first two treasury
failures (Portugal month 11, Netherlands month 12). The ten-year run continues
until every nation's obligations exceed its treasury. This is a property of an
unattended run with no player budget/appropriation commands, not of the 1880
progression content: the run never changes content, the pack, the ruleset or the
economy. The N-3 acceptance is about decisions and unlocks, not solvency.

### E4. Authority

- Spec #47 R5 (stop condition above) and ticket #50 (same wording).
- `.ai/ROADMAP.md` "a capability counts only when a deterministic test drives it
  from a compiled campaign month"; "never weaken a gate or its fixtures".
- AGENTS.md stop conditions: a gate would need weakening to pass.
- The existing N-2 allowlist (`ten-nation-smoke.test.ts:180–188`) names only
  `portugal|NEGATIVE_TREASURY_OBLIGATION` and
  `netherlands|NEGATIVE_TREASURY_OBLIGATION`.

## Why agent judgment is insufficient

Choosing to allowlist the other twelve nations changes what the acceptance run
certifies: either "the decade is deterministic and progression is observable
despite an expected unattended economy collapse" (A/D) or "the economy must stay
solvent for a decade" (C). Those are different gameplay/acceptance claims. The
spec deliberately made any new failure a stop condition, so the agent must not
silently generalize the allowlist.

## Options

### Option A: Generalize the allowlist to the unattended-run treasury baseline

- Behavior: `NEGATIVE_TREASURY_OBLIGATION` for **any** nation is treated as the
  known command-free decade baseline; every other diagnostic code fails. The test
  still asserts deterministic checkpoints and that the baseline reproduces.
- Change: acceptance test only; no content, engine, schema or golden change.
- Risk: the gate no longer names the nation set; a future genuinely new treasury
  failure in an unattended run would not be distinguished. The report must state
  the observed set and that the run is not a solvency test.

### Option B: Keep the two-nation allowlist and stop the run earlier

- Behavior: keep N-2's twelve-month smoke as the only economic gate; treat the
  ten-year run as diagnostic-only or skip it.
- Risk: N-3 loses the ten-year determinism proof, which is a core acceptance
  claim. Not recommended.

### Option C: Fix the unattended economy/AI so a decade stays solvent

- Behavior: change economy, AI procurement or obligation behaviour until no
  nation goes negative without commands.
- Cost: a behavioural change to authoritative outcomes, goldens and saves; a
  separate milestone-sized effort, outside N-3's non-behavioural scope. Needs its
  own fidelity decision.

### Option D: Gate codes, report treasury diagnostics as expected

- Behavior: the run asserts determinism/checkpoints and fails on any diagnostic
  code other than `NEGATIVE_TREASURY_OBLIGATION`; the report lists the treasury
  diagnostics as an observed command-free baseline without calling it a pass.
- Difference from A: A also asserts the baseline reproduces; D only tolerates the
  code. Both keep the progression proof.

### Option E: Inject a fixture budget/treasury floor for the run

- Behavior: run a scenario copy with extra treasury so the decade stays solvent.
- Risk: the run would no longer start from the committed production pack; it
  would not prove the shipped scenario.

## Recommendation

[REC] Option A. It preserves the N-3 acceptance (deterministic 120-month run with
yearly checkpoints and named unlocks), changes no authoritative behaviour, and
states honestly that a command-free decade is insolvent. Option C is the only
option that would make solvency itself a rule, and it is outside N-3. The owner
must choose; the agent will not generalize the allowlist without approval.

## Effect on tickets

- #50: blocked until this decision; the `production-ten-year` mode and the red
  test exist, the test must not be allowlisted or skipped silently.
- #51: blocked by #50; the probe harness can reuse the same January snapshots
  once #50 is accepted.
- #53: blocked by #50/#51; the report must record this decision and the observed
  baseline either way.
- #95: follow-up ticket for option C (economy/AI solvency), created at the
  owner's request; not part of N-3.

## Owner response

- Selection: `[x] A  [ ] B  [x] C (as a separate follow-up ticket, not N-3)` ;
  notes: N-3 accepts the command-free treasury baseline; the economy/AI solvency
  fix becomes its own ticket.
- If A/D: is the observed 14-nation set accepted as the command-free baseline?
  `[x] yes  [ ] no`
- Owner / date: 2026-10-17
