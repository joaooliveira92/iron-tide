export interface SearchTarget {
  readonly id: string;
  readonly label: string;
}

/** Case-insensitive substring match over target labels. An empty query matches nothing. */
export function filterSearchTargets(
  targets: readonly SearchTarget[],
  query: string,
): readonly SearchTarget[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];
  return targets.filter((target) => target.label.toLowerCase().includes(trimmed));
}
