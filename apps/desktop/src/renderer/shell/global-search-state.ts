export interface SearchTarget {
  readonly id: string;
  readonly label: string;
}

export function filterSearchTargets(
  targets: readonly SearchTarget[],
  query: string,
): readonly SearchTarget[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];
  return targets.filter((target) => target.label.toLowerCase().includes(trimmed));
}
