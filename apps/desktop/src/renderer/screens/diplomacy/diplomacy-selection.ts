import type { DiplomacyRelationRow } from "./diplomacy-view-model.js";

export function resolveSelectedNation(
  rows: readonly DiplomacyRelationRow[],
  picked: string | null,
  draftPartnerId: string | null,
): DiplomacyRelationRow | null {
  const byId = (id: string | null) =>
    id === null ? undefined : rows.find((row) => row.partnerNationId === id);
  return byId(picked) ?? byId(draftPartnerId) ?? rows[0] ?? null;
}

export function stepSelection(
  rows: readonly DiplomacyRelationRow[],
  currentId: string | null,
  direction: 1 | -1,
): string | null {
  if (rows.length === 0) return null;
  const index = rows.findIndex((row) => row.partnerNationId === currentId);
  const next = index === -1 ? 0 : (index + direction + rows.length) % rows.length;
  return rows[next]!.partnerNationId;
}
