/**
 * Runs a generator in short slices so a long computation never blocks a frame.
 * Each `yield` is a safe pause point; the driver keeps stepping until the time
 * budget is spent, then hands control back via `schedule` and resumes later.
 * Used to build the coastline detail levels in the background (ADR-0055).
 */

export interface TimeSliceOptions {
  /** Milliseconds of work per slice. */
  readonly budgetMs: number;
  readonly now: () => number;
  /** Runs `resume` later (setTimeout/requestIdleCallback in production). */
  readonly schedule: (resume: () => void) => void;
}

export interface TimeSliceHandle {
  readonly cancel: () => void;
}

export function runTimeSliced<T>(
  task: Generator<void, T>,
  options: TimeSliceOptions,
  onDone: (result: T) => void,
): TimeSliceHandle {
  let cancelled = false;
  const slice = () => {
    if (cancelled) return;
    const deadline = options.now() + options.budgetMs;
    do {
      const step = task.next();
      if (step.done === true) {
        onDone(step.value);
        return;
      }
    } while (options.now() < deadline);
    options.schedule(slice);
  };
  options.schedule(slice);
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
