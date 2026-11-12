import type { BudgetModifier, NationEventHistory } from "@bluewave/campaign";

export function cloneEventHistory(
  history: NationEventHistory | undefined,
): NationEventHistory | undefined {
  if (history === undefined) return undefined;
  return {
    fired: history.fired.map((record) => ({
      ...record,
      ...(record.effects === undefined
        ? {}
        : {
            effects: {
              ...record.effects,
              lines: record.effects.lines.map((line) => ({ ...line })),
            },
          }),
    })),
    flags: [...history.flags],
    ...(history.pending === undefined ? {} : { pending: { ...history.pending } }),
  };
}

export function cloneBudgetModifiers(
  modifiers: readonly BudgetModifier[] | undefined,
): BudgetModifier[] | undefined {
  return modifiers?.map((modifier) => ({ ...modifier }));
}
