export interface TimeSliceOptions {
  readonly budgetMs: number;
  readonly now: () => number;
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
