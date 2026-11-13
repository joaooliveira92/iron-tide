import { render } from "@testing-library/react";
import { vi } from "vite-plus/test";
import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { BluewaveDesktopBridge } from "../../../../preload/index.js";
import type { CampaignCommandClient } from "../../../../shared/campaign-contract.js";
import { DEFAULT_APP_PREFERENCES } from "../../../../shared/preferences-contract.js";
import { BridgeProvider } from "../../../lib/bridge-context.js";
import { PreferencesProvider } from "../../../lib/preferences-context.js";
import { BattleSessionProvider } from "./BattleSession.js";
import type { ReactNode } from "react";

export const NM_UM = 1_852_000_000;

export const ship = (patch: Partial<PlayerBattleShipView>): PlayerBattleShipView => ({
  shipId: "a1",
  name: "HMS Alpha",
  className: "A",
  shipType: "ironclad",
  sideId: "ATTACKER",
  divisionId: "d1",
  hitPoints: 100,
  maxHitPoints: 100,
  damageState: "NORMAL",
  position: [0, 0],
  headingDeg: 90,
  speedBp: 12_000,
  contactConfidenceBp: null,
  ...patch,
});

export const BASE_VIEW: PlayerBattleView = {
  battleId: "b1",
  campaignMonth: "1880-02",
  playerNationId: "uk",
  areaId: "channel",
  attackerId: "uk",
  defenderId: "france",
  minute: 0,
  maxMinutes: 120,
  ended: false,
  endReason: null,
  winnerId: null,
  loserId: null,
  objectives: [],
  weather: { seaState: "MODERATE", visibilityNm: 10, precipitation: "CLEAR", daylight: true },
  ships: [
    ship({}),
    ship({ shipId: "a2", name: "HMS Bravo", position: [-NM_UM / 4, 0] }),
    ship({
      shipId: "e1",
      name: "FS Corse",
      sideId: "DEFENDER",
      divisionId: "ed1",
      position: [40 * NM_UM, 10 * NM_UM],
      headingDeg: 270,
    }),
  ],
  divisions: [
    {
      divisionId: "d1",
      sideId: "ATTACKER",
      role: "BATTLE_LINE",
      formation: "LINE_AHEAD",
      flagshipId: "a2",
      unitIds: ["a1", "a2"],
    },
    {
      divisionId: "ed1",
      sideId: "DEFENDER",
      role: "BATTLE_LINE",
      formation: "LINE_AHEAD",
      flagshipId: "e1",
      unitIds: ["e1"],
    },
  ],
  log: [],
};

export function mountSession(
  children: ReactNode,
  advanced: PlayerBattleView = BASE_VIEW,
  initial: PlayerBattleView = BASE_VIEW,
) {
  const execute = vi.fn<CampaignCommandClient["execute"]>((command) => {
    const view = command === "advancePlayerBattle" ? advanced : initial;
    return Promise.resolve({
      outcome: "success",
      value: { view, sessionHash: "h", resumed: false, lastOrders: [], result: null },
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
