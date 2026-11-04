import type { StripRow } from "../status-strip-state.js";

export function rowById(rows: readonly StripRow[], id: string): StripRow | undefined {
  return rows.find((row) => row.id === id);
}
