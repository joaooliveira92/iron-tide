/**
 * Turns an engine identifier into readable player-facing text:
 * `HULL_CONSTRUCTION` -> "Hull construction", `war_imminent` -> "War imminent".
 * Display only — never use the result as a key or compare it to engine ids.
 */
export function humanizeId(id: string): string {
  const words = id
    .split(/[_\s]+/)
    .filter((word) => word.length > 0)
    .join(" ")
    .toLowerCase();
  return words.length === 0 ? id : words.charAt(0).toUpperCase() + words.slice(1);
}
