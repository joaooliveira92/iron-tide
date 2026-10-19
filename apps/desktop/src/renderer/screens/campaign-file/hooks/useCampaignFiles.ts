import { useCallback, useEffect, useRef, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";

import type { RecentCampaignEntry } from "../../../../shared/continuity-contract.js";
import type { OperationKind, OperationResult } from "../types.js";
import {
  operationPendingLabel,
  recoveryResultFromBridge,
  replayResultFromBridge,
  verificationResultFromBridge,
} from "../utils/package-operations.js";

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
  readonly runPackageOperation: (kind: OperationKind) => void;
  readonly dismissResult: () => void;
}

export function useCampaignFiles({
  onOpenCampaign,
}: UseCampaignFilesOptions): UseCampaignFilesResult {
  const bridge = useBridge();
  const [recentFiles, setRecentFiles] = useState<readonly RecentCampaignEntry[]>([]);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [pendingOperation, setPendingOperation] = useState<OperationKind | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resultTimerRef.current !== null) clearTimeout(resultTimerRef.current);
    },
    [],
  );

  const showResult = useCallback((nextResult: OperationResult) => {
    setResult(nextResult);
    if (resultTimerRef.current !== null) clearTimeout(resultTimerRef.current);
    // Errors stay until dismissed; only success summaries expire.
    resultTimerRef.current =
      nextResult.kind === "error" ? null : setTimeout(() => setResult(null), 15_000);
  }, []);

  const refreshRecents = useCallback(async () => {
    if (bridge === undefined) return;
    const listed = await bridge.campaign.execute("listRecentCampaigns", undefined);
    if (listed.outcome === "success") setRecentFiles(listed.value);
  }, [bridge]);

  useEffect(() => {
    void refreshRecents();
  }, [refreshRecents]);

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
        // Not a package the main process remembers: ask the user to pick it.
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
      if (removed.outcome === "success") setRecentFiles(removed.value);
    },
    [bridge],
  );

  const runPackageOperation = useCallback(
    async (kind: OperationKind) => {
      if (bridge === undefined) return;
      setPendingOperation(kind);
      setPendingLabel(operationPendingLabel(kind));
      const operationResult =
        kind === "verify"
          ? verificationResultFromBridge(await bridge.campaign.execute("verifyCampaign", undefined))
          : kind === "replay"
            ? replayResultFromBridge(await bridge.campaign.execute("replayCampaign", undefined))
            : recoveryResultFromBridge(await bridge.campaign.execute("recoverCampaign", undefined));

      setPendingOperation(null);
      setPendingLabel(null);
      showResult(operationResult);
    },
    [bridge, showResult],
  );

  const dismissResult = useCallback(() => setResult(null), []);

  return {
    recentFiles,
    result,
    pendingOperation,
    pendingLabel,
    openCampaign: () => void openCampaign(),
    openRecentCampaign: (file) => void openRecentCampaign(file),
    removeRecentCampaign: (packagePath) => void removeRecentCampaign(packagePath),
    runPackageOperation: (kind) => void runPackageOperation(kind),
    dismissResult,
  };
}
