# Decision Request: Accelerate cancels itself under capacity pressure (issue #574)

## Status

Blocked pending owner decision.

## Trigger

Issue #574 asks that Accelerate "actually accelerates" (acceptance criterion 1: an accelerated paced project completes earlier by the content factor), and lists "Changing the delay-pressure model" as out of scope. The delay-pressure model, as the engine runs it today, makes the first goal impossible: the issue contradicts itself.

## Evidence

- `packages/phase-engine/src/economyPhases.ts` (`runAppropriationPhase`) passes `availableCapacity: ACCELERATION_POOL_UNDEFINED_UNITS` (`0`) to `resolveAccelerationCapacityPressure`.
- `constructionCapacityPressureBp` divides by `max(1, availableCapacity)`, so any accelerated demand of 1 unit or more gives pressure far above `ACCELERATION_DELAY_THRESHOLD_BP` (9_000), and `accelerationDelayProbabilityBp` returns the cap (`ACCELERATION_DELAY_PROBABILITY_CAP_BP`, 5_000 bp = 50%).
- `packages/phase-engine/test/construction-acceleration.test.ts:305` pins this ("no capacity pool is defined, so any demand hits the delay cap").
- A project delayed by pressure is moved to `DELAYED`, receives zero work and zero charge that month, and the next appropriation resumes it to `ACTIVE` (`constructionResumeTarget`, test at `:476`). Acceleration is therefore dropped after the first delay, while the 5% premium (applied once at the command) is already paid.
- Net effect per accelerated project: a 50% chance each month of losing a month's work and losing the accelerated status. This, more than the 1.05/1.10 constants, explains the playtest report "Accelerate gave no visible speed-up".
- A second engine defect, independent of the decision: `isPaced` in `packages/campaign/src/constructionDraw.ts` returns false for `ACCELERATED`, so accelerating a paced project removes its cumulative pace limit and its `buildTimeMultiplierBp` scaling (the latter only applies when `buildMonths` is unset) instead of compressing the schedule by `accelerationTimeBp`.

## Why agent judgment is insufficient

Each way of making Accelerate work changes authoritative outcomes and gameplay, and the issue forbids touching the delay model:

- Defining a capacity pool changes who gets delayed and how often, for every save and every golden hash that contains an accelerated project.
- Keeping the 50% delay but preserving `ACCELERATED` across a delay changes the economics of acceleration in a different direction.
- Shipping the preview and dialogs on the current model would show players a "months saved" figure that the engine then undoes half the time, and a delay risk that is always 50%.

## Options

### Option A: Define the capacity pool (change the pressure model)

- Behavior: replace `ACCELERATION_POOL_UNDEFINED_UNITS` with the nation's real monthly construction capacity so pressure is only above threshold when many ships are accelerated together.
- Advantages: matches the tooltip ("accelerating many ships risks delaying others") and the issue's intent.
- Risks: gameplay and balance change; the pool definition needs a source (RTW3 manual is silent) and so stays PROVISIONAL.
- Compatibility impact: RNG stream family unchanged, but draws and delay outcomes change for every accelerated project; golden hashes move where accelerated projects exist; compat-version bump for the ruleset.
- Migration impact: none for saves with no accelerated project.
- Scope and effort: engine plus content; the issue's scope is widened beyond its stated out-of-scope list.

### Option B: Keep the pressure model, keep `ACCELERATED` through a delay

- Behavior: a delayed accelerated project returns to `ACCELERATED` rather than `ACTIVE`.
- Advantages: smallest change; the delay costs one month, acceleration survives.
- Risks: still 50% monthly delay for any accelerated project, so net speed-up is about zero; the preview must state the probability honestly.
- Compatibility impact: changes outcomes only for projects that have been delayed by pressure.
- Migration impact: none.
- Scope and effort: small, but does not satisfy "actually accelerates".

### Option C: Ship the issue as written, on the current model

- Behavior: single source of truth for the constants, previews, dialogs; Accelerate still self-cancels about half the time.
- Advantages: no gameplay change; honest preview (shows the 50% risk).
- Risks: criterion 1 ("earlier by the content factor") holds only in a seed where no delay fires, so it cannot be a general engine guarantee.
- Compatibility impact: hashes change only through the constants.
- Migration impact: none.
- Scope and effort: as in the issue.

## Recommendation

Option A for the engine, with the issue's constants, preview and dialog work built on top of it. Option C is the fallback if the owner wants the delay model left alone for now; in that case criterion 1 should be restated to "when no delay fires". Do not implement the disputed behaviour before approval.

## Work safely completed while blocked

None committed. The constants, preview and dialog slices all depend on whether the delay risk they display is meaningful, so they were not started.
