import type { BattleHistoryView } from "@bluewave/campaign-engine";

import { useRead } from "../../../lib/use-read.js";

export type BattleHistoryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly history: BattleHistoryView }
  | { readonly status: "error"; readonly message: string };

export function useBattleHistory(sessionId: string, revision: number): BattleHistoryState {
  const read = useRead("inspectBattleHistory", sessionId, revision);

  if (read.status === "ready") return { status: "ready", history: read.value.history };
  if (read.status === "unavailable") return { status: "error", message: read.reason };
  return { status: "loading" };
}
