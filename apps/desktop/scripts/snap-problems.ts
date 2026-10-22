export interface ProblemLog {
  readonly record: (message: string, key?: string) => void;
  readonly list: () => readonly string[];
  readonly exitCode: (strict: boolean) => 0 | 1;
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
