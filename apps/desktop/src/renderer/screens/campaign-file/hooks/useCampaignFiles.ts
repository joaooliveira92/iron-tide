import { useCallback, useEffect, useRef, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";

import type { BridgeResult } from "../../../../shared/bridge-contract.js";
import type { LoadCampaignResponse } from "../../../../shared/continuity-contract.js";
import type { OperationKind, OperationResult, RecentFile } from "../types.js";
import { loadRecentFiles, removeRecentFile, saveRecentFile } from "../utils/recent-files.js";
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
  readonly recentFiles: readonly RecentFile[];
  readonly result: OperationResult | null;
  readonly pendingOperation: OperationKind | null;
  readonly pendingLabel: string | null;
  readonly openCampaign: () => void;
  readonly openRecentCampaign: (file: RecentFile) => void;
  readonly removeRecentCampaign: (path: string) => void;
  readonly runPackageOperation: (kind: OperationKind) => void;
  readonly dismissResult: () => void;
}

export function useCampaignFiles({
  onOpenCampaign,
}: UseCampaignFilesOptions): UseCampaignFilesResult {
  const bridge = useBridge();
  const [recentFiles, setRecentFiles] = useState<readonly RecentFile[]>(loadRecentFiles);
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
    resultTimerRef.current = setTimeout(() => setResult(null), 15_000);
  }, []);

  const recordLoadedCampaign = useCallback(
    (
      path: string,
      loadResult: Extract<BridgeResult<LoadCampaignResponse>, { outcome: "success" }>,
    ) => {
      saveRecentFile({
        path,
        campaignIdentity: loadResult.value.campaignIdentity,
        activeRevision: loadResult.value.activeRevision,
        lastOpened: Date.now(),
      });
      setRecentFiles(loadRecentFiles());
      onOpenCampaign(loadResult.value.sessionId);
    },
    [onOpenCampaign],
  );

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

    recordLoadedCampaign(loadResult.value.packagePath, loadResult);
  }, [bridge, recordLoadedCampaign, showResult]);

  const openRecentCampaign = useCallback(
    async (file: RecentFile) => {
      if (bridge === undefined) return;
      setPendingLabel("Loading campaign…");
      const loadResult = await bridge.campaign.execute("loadRecentCampaign", {
        packagePath: file.path,
      });
      setPendingLabel(null);

      if (loadResult.outcome === "success") {
        recordLoadedCampaign(file.path, loadResult);
        return;
      }
      // Not approved by the main process (or gone from disk): ask the user to pick it again.
      await openCampaign();
    },
    [bridge, openCampaign, recordLoadedCampaign],
  );

  const removeRecentCampaign = useCallback((path: string) => {
    removeRecentFile(path);
    setRecentFiles(loadRecentFiles());
  }, []);

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
    removeRecentCampaign,
    runPackageOperation: (kind) => void runPackageOperation(kind),
    dismissResult,
  };
}
