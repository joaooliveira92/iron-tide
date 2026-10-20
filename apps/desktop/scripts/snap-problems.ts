/**
 * What `pnpm snap --strict` fails on. Problems are always collected; only strict mode turns them
 * into a non-zero exit. Reports about the same subject (one control that could not be clicked)
 * share a key so the run reports the final, most specific cause once instead of every step.
 */
export interface ProblemLog {
  /** Record a problem. A later report with the same `key` replaces the earlier one. */
  readonly record: (message: string, key?: string) => void;
  readonly list: () => readonly string[];
  readonly exitCode: (strict: boolean) => 0 | 1;
  /** The strict-mode failure text, or `undefined` when there is nothing to report. */
  readonly summary: () => string | undefined;
}

export function createProblemLog(): ProblemLog {
  const entries: { key: string; message: string }[] = [];
  const record = (message: string, key = message) => {
    const at = entries.findIndex((e) => e.key === key);
    if (at >= 0) entries[at] = { key, message };
    else entries.push({ key, message });
  };
  const list = () => entries.map((e) => e.message);
  return {
    record,
    list,
    exitCode: (strict) => (strict && entries.length > 0 ? 1 : 0),
    summary: () =>
      entries.length === 0
        ? undefined
        : [`snap --strict: ${entries.length} problem(s)`, ...list().map((m) => `  - ${m}`)].join(
            "\n",
          ),
  };
}
