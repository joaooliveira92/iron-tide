import { useEffect, useMemo, useState } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import { envelopeOf, stampCommand } from "../../../../lib/command-envelope.js";
import type { BluewaveDesktopBridge } from "../../../../../preload/index.js";
import type {
  RebuildableShipView,
  RebuildCheckView,
} from "../../../../../shared/design-contract.js";
import { useCampaignRevision } from "../../../../shell/CampaignShellContext.js";
import { bulgeMassKg, failureText, withBulgeMass, type RebuildAction } from "./rebuildDraft.js";

export interface RebuildResult {
  readonly tone: "ok" | "bad";
  readonly text: string;
}

export function useRebuildState({
  bridge,
  sessionId,
  draft,
  onLoad,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly sessionId: string | undefined;
  readonly draft: DesignDraft | null;
  readonly onLoad: (draft: Record<string, unknown>) => void;
}) {
  const revision = useCampaignRevision();
  const [ships, setShips] = useState<readonly RebuildableShipView[]>([]);
  const [chosen, setChosen] = useState("");
  const [loaded, setLoaded] = useState<{ shipId: string } | null>(null);
  const [check, setCheck] = useState<RebuildCheckView | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RebuildResult | null>(null);
  const [action, setAction] = useState<RebuildAction>("STANDARD");
  const [blisterMassKg, setBlisterMassKg] = useState(0);
  const ship = ships.find((s) => s.shipId === chosen) ?? ships[0];
  const shipId = ship?.shipId;
  const massKg = bulgeMassKg(action, blisterMassKg);
  const checkedDraft = useMemo<DesignDraft | null>(
    () => (draft === null ? null : withBulgeMass(draft, massKg)),
    [draft, massKg],
  );
  const rebuildKind = action === "BULGE" ? "BULGE" : undefined;
  const checkedDraftKey = useMemo(() => JSON.stringify(checkedDraft), [checkedDraft]);

  useEffect(() => {
    setShips([]);
    if (!bridge || sessionId === undefined) return;
    let live = true;
    void bridge.campaign.execute("listRebuildableShips", sessionId).then((r) => {
      if (live && r.outcome === "success") setShips(r.value);
    });
    return () => {
      live = false;
    };
  }, [bridge, sessionId, revision]);

  useEffect(() => {
    setCheck(null);
    if (!bridge || sessionId === undefined || shipId === undefined) return;
    if (loaded?.shipId !== shipId || checkedDraft === null) return;
    let live = true;
    void bridge.campaign
      .execute("checkRebuild", {
        sessionId,
        shipId,
        draft: { ...checkedDraft },
        ...(rebuildKind === undefined ? {} : { rebuildKind }),
      })
      .then((r) => {
        if (live && r.outcome === "success") setCheck(r.value);
      });
    return () => {
      live = false;
    };
  }, [bridge, sessionId, shipId, loaded, checkedDraft, checkedDraftKey, rebuildKind]);

  const isLoaded = ship !== undefined && loaded?.shipId === ship.shipId;
  const canStart = isLoaded && check !== null && check.legal && revision !== null && !busy;

  const load = async () => {
    if (!bridge || sessionId === undefined || ship === undefined) return;
    const r = await bridge.campaign.execute("loadShipDraft", {
      sessionId,
      shipId: ship.shipId,
    });
    if (r.outcome === "success") {
      onLoad(r.value.draft);
      setLoaded({ shipId: ship.shipId });
      setResult(null);
    } else setResult({ tone: "bad", text: failureText(r) });
  };

  const start = async () => {
    if (
      !bridge ||
      sessionId === undefined ||
      ship === undefined ||
      revision === null ||
      checkedDraft === null
    )
      return;
    setBusy(true);
    try {
      const r = await bridge.campaign.execute("startRebuildCommand", {
        ...envelopeOf(sessionId, stampCommand("rebuild", revision)),
        shipId: ship.shipId,
        draft: { ...checkedDraft },
        ...(rebuildKind === undefined ? {} : { rebuildKind }),
      });
      setResult(
        r.outcome === "success"
          ? {
              tone: "ok",
              text: `Rebuild of ${ship.name} queued. It starts when the month is committed; the ship is unavailable until the rebuild is finished.`,
            }
          : { tone: "bad", text: failureText(r) },
      );
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: string) => {
    setChosen(id);
    setResult(null);
  };

  const chooseAction = (next: RebuildAction) => {
    setAction(next);
    setResult(null);
  };

  return {
    state: {
      ships,
      ship,
      action,
      blisterMassKg,
      bulgeMassKg: massKg,
      check,
      result,
      busy,
      isLoaded,
      canStart,
    },
    actions: {
      choose,
      chooseAction,
      setBlisterMassKg,
      load,
      start,
    },
  };
}
