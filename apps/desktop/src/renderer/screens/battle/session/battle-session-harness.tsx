import { render } from "@testing-library/react";
import { vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../../../preload/index.js";
import type { CampaignCommandClient } from "../../../../shared/campaign-contract.js";
import { DEFAULT_APP_PREFERENCES } from "../../../../shared/preferences-contract.js";
import { BridgeProvider } from "../../../lib/bridge-context.js";
import { PreferencesProvider } from "../../../lib/preferences-context.js";
import { battleViewFor } from "../tactical/tactical-view-fixture.js";
import type { TacticalShip, TacticalView } from "../tactical/tactical-view.js";
import { BattleSessionProvider } from "./BattleSession.js";
import {
  useBattleActions,
  useBattleCameraState,
  useBattleMeta,
  useBattleState,
  type BattleSessionActions,
  type BattleSessionCamera,
  type BattleSessionMeta,
  type BattleSessionState,
} from "./battle-session-contexts.js";
import type { ReactNode } from "react";

export interface BattleSessionSnapshot {
  readonly state: BattleSessionState & BattleSessionCamera;
  readonly actions: BattleSessionActions;
  readonly meta: BattleSessionMeta;
}

export function useBattleSessionSnapshot(): BattleSessionSnapshot {
  const state = useBattleState();
  const camera = useBattleCameraState();
  return { state: { ...state, ...camera }, actions: useBattleActions(), meta: useBattleMeta() };
}

export const NM_UM = 1_852_000_000;

export const ship = (patch: Partial<TacticalShip>): TacticalShip => ({
  shipId: "a1",
  name: "HMS Alpha",
  own: true,
  shipType: "ironclad",
  divisionId: "d1",
  hitPoints: 100,
  maxHitPoints: 100,
  damageState: "NORMAL",
  position: [0, 0],
  headingDeg: 90,
  speedMilliKnots: 12_000,
  contactConfidenceBp: null,
  ...patch,
});

export const BASE_VIEW: TacticalView = {
  battleId: "b1",
  campaignMonth: "1880-02",
  areaId: "channel",
  minute: 0,
  maxMinutes: 120,
  ended: false,
  endReason: null,
  winnerId: null,
  loserId: null,
  objectives: [],
  weather: { seaState: "MODERATE", visibilityM: 18_520, precipitation: "CLEAR", daylight: true },
  ships: [
    ship({}),
    ship({ shipId: "a2", name: "HMS Bravo", position: [-NM_UM / 4, 0] }),
    ship({
      shipId: "e1",
      name: "Unidentified contact e1",
      own: false,
      shipType: null,
      divisionId: null,
      hitPoints: null,
      maxHitPoints: null,
      position: [40 * NM_UM, 10 * NM_UM],
      headingDeg: 270,
      contactConfidenceBp: 10_000,
    }),
  ],
  divisions: [
    {
      divisionId: "d1",
      role: "BATTLE_LINE",
      formation: "LINE_AHEAD",
      flagshipId: "a2",
      unitIds: ["a1", "a2"],
    },
  ],
  log: [],
};

export function mountSession(
  children: ReactNode,
  advanced: TacticalView = BASE_VIEW,
  initial: TacticalView = BASE_VIEW,
) {
  const execute = vi.fn<CampaignCommandClient["execute"]>((command) => {
    const view = command === "advancePlayerBattle" ? advanced : initial;
    return Promise.resolve({
      outcome: "success",
      value: {
        battleView: battleViewFor(view),
        sessionHash: "h",
        resumed: false,
        lastOrders: [],
        result: null,
      },
      diagnostics: [],
    } as never);
  });
  const snapshot = { version: 1, app: DEFAULT_APP_PREFERENCES };
  const bridge: BluewaveDesktopBridge = {
    campaign: { execute },
    preferences: {
      read: () => Promise.resolve({ outcome: "success", value: snapshot } as never),
      write: () => Promise.resolve({ outcome: "success", value: snapshot } as never),
      readCampaign: () => Promise.resolve({ outcome: "error", reason: "x", diagnostics: [] }),
      writeCampaign: () => Promise.resolve({ outcome: "error", reason: "x", diagnostics: [] }),
    },
    platform: "darwin",
    getWindowState: () => Promise.reject(new Error("unused")),
    windowMinimize: () => {},
    windowMaximizeToggle: () => {},
    windowClose: () => {},
  };
  render(
    <BridgeProvider bridge={bridge}>
      <PreferencesProvider>
        <BattleSessionProvider
          sessionId="s"
          battleId="b1"
          areaId="channel"
          onSubmitResult={() => {}}
        >
          {children}
        </BattleSessionProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
  return { execute };
}
