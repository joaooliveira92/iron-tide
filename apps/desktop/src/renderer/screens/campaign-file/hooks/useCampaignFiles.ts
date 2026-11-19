import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import { createTimedValue } from "../../../lib/timed-value.js";
import { createValueStore, subscribeWithLifecycle } from "../../../lib/value-store.js";

import type { RecentCampaignEntry } from "../../../../shared/continuity-contract.js";
import type { OperationKind, OperationResult } from "../types.js";
import {
  operationPendingLabel,
  recoveryResultFromBridge,
  replayResultFromBridge,
  verificationResultFromBridge,
} from "../utils/package-operations.js";

const RESULT_LIFETIME_MS = 15_000;

interface UseCampaignFilesOptions {
  readonly onOpenCampaign: (sessionId: string) => void;
}

interface UseCampaignFilesResult {
  readonly recentFiles: readonly RecentCampaignEntry[];
  readonly result: OperationResult | null;
  readonly pendingOperation: OperationKind | null;
  readonly pendingLabel: string | null;
  readonly openCampaign: () => void;
  readonly openRecentCampaign: (file: RecentCampaignEntry) => void;
  readonly removeRecentCampaign: (packagePath: string) => void;
  readonly runPackageOperation: (kind: OperationKind, packagePath?: string) => void;
  readonly dismissResult: () => void;
}

export function useCampaignFiles({
  onOpenCampaign,
}: UseCampaignFilesOptions): UseCampaignFilesResult {
  const bridge = useBridge();
  const [recents] = useState(() => createValueStore<readonly RecentCampaignEntry[]>([]));
  const [results] = useState(() =>
    createTimedValue<OperationResult>((value) =>
      value.kind === "error" ? null : RESULT_LIFETIME_MS,
    ),
  );
  const [pendingOperation, setPendingOperation] = useState<OperationKind | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const result = useSyncExternalStore(results.subscribe, results.get);
  const showResult = results.show;

  const refreshRecents = useCallback(async () => {
    if (bridge === undefined) return;
    const listed = await bridge.campaign.execute("listRecentCampaigns", undefined);
    if (listed.outcome === "success") recents.set(listed.value);
  }, [bridge, recents]);

  const subscribeRecents = useMemo(
    () =>
      subscribeWithLifecycle(recents, () => {
        void refreshRecents();
      }),
    [recents, refreshRecents],
  );
  const recentFiles = useSyncExternalStore(subscribeRecents, recents.get);

  const openCampaign = useCallback(async () => {
    if (bridge === undefined) return;
    setPendingLabel("Loading campaign…");
    const loadResult = await bridge.campaign.execute("loadCampaign", undefined);
    setPendingLabel(null);

    if (loadResult.outcome !== "success") {
      const diagnostics =
        loadResult.diagnostics.length > 0 ? ` — ${loadResult.diagnostics.join("; ")}` : "";
      showResult({
        kind: "error",
        message: `Load failed: ${loadResult.reason}${diagnostics}`,
      });
      return;
    }

    onOpenCampaign(loadResult.value.sessionId);
  }, [bridge, onOpenCampaign, showResult]);

  const openRecentCampaign = useCallback(
    async (file: RecentCampaignEntry) => {
      if (bridge === undefined) return;
      setPendingLabel("Loading campaign…");
      const loadResult = await bridge.campaign.execute("loadRecentCampaign", {
        packagePath: file.packagePath,
      });
      setPendingLabel(null);

      if (loadResult.outcome === "success") {
        onOpenCampaign(loadResult.value.sessionId);
        return;
      }
      if (loadResult.reason === "PACKAGE_NOT_APPROVED") {
        await openCampaign();
        return;
      }
      await refreshRecents();
      const diagnostics =
        loadResult.diagnostics.length > 0 ? ` — ${loadResult.diagnostics.join("; ")}` : "";
      showResult({ kind: "error", message: `Load failed: ${loadResult.reason}${diagnostics}` });
    },
    [bridge, onOpenCampaign, openCampaign, refreshRecents, showResult],
  );

  const removeRecentCampaign = useCallback(
    async (packagePath: string) => {
      if (bridge === undefined) return;
      const removed = await bridge.campaign.execute("removeRecentCampaign", { packagePath });
      if (removed.outcome === "success") recents.set(removed.value);
    },
    [bridge, recents],
  );

  const runPackageOperation = useCallback(
    async (kind: OperationKind, packagePath?: string) => {
      if (bridge === undefined) return;
      const payload = packagePath === undefined ? undefined : { packagePath };
      setPendingOperation(kind);
      setPendingLabel(operationPendingLabel(kind));
      const operationResult =
        kind === "verify"
          ? verificationResultFromBridge(await bridge.campaign.execute("verifyCampaign", payload))
          : kind === "replay"
            ? replayResultFromBridge(await bridge.campaign.execute("replayCampaign", payload))
            : recoveryResultFromBridge(await bridge.campaign.execute("recoverCampaign", payload));

      setPendingOperation(null);
      setPendingLabel(null);
      showResult(operationResult);
      if (packagePath !== undefined) await refreshRecents();
    },
    [bridge, refreshRecents, showResult],
  );

  const dismissResult = results.dismiss;

  return {
    recentFiles,
    result,
    pendingOperation,
    pendingLabel,
    openCampaign: () => void openCampaign(),
    openRecentCampaign: (file) => void openRecentCampaign(file),
    removeRecentCampaign: (packagePath) => void removeRecentCampaign(packagePath),
    runPackageOperation: (kind, packagePath) => void runPackageOperation(kind, packagePath),
    dismissResult,
  };
}
