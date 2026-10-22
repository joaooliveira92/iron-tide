import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type {
  CampaignCommandClient,
  InterruptionRequestDto,
} from "../../../shared/campaign-command-contract.js";
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from "../../../shared/preferences-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { PreferencesProvider } from "../../lib/preferences-context.js";
import { PlayerBattleScreen } from "./PlayerBattleScreen.js";

const VIEW: PlayerBattleView = {
  battleId: "b1",
  campaignMonth: "1880-02",
  playerNationId: "uk",
  areaId: "channel",
  attackerId: "uk",
  defenderId: "france",
  minute: 3,
  maxMinutes: 120,
  ended: false,
  endReason: null,
  winnerId: null,
  loserId: null,
  objectives: [],
  weather: { seaState: "MODERATE", visibilityNm: 10, precipitation: "CLEAR", daylight: true },
  ships: [
    {
      shipId: "s1",
      name: "HMS Alpha",
      className: "A",
      shipType: "ironclad",
      sideId: "ATTACKER",
      divisionId: "d1",
      hitPoints: 40,
      maxHitPoints: 100,
      damageState: "CRIPPLED",
      position: [0, 0],
    },
  ],
  divisions: [
    {
      divisionId: "d1",
      sideId: "ATTACKER",
      role: "BATTLE_LINE",
      formation: "LINE_AHEAD",
      flagshipId: "s1",
      unitIds: ["s1"],
    },
  ],
  log: [],
};

const REQUEST: InterruptionRequestDto = {
  kind: "battle",
  turnId: "t1",
  interruptionId: "i1",
  ordinal: 0,
  phase: "battle_resolution",
  titleKey: "t",
  bodyKey: "b",
  interpolation: {},
  battleId: "b1",
  areaId: "channel",
};

function startReply(view: PlayerBattleView, resumed: boolean, lastOrders: unknown[]) {
  return Promise.resolve({
    outcome: "success",
    value: { view, sessionHash: "h", resumed, lastOrders },
  } as never);
}

function bridgeWith(
  prefs: Partial<AppPreferences>,
  start: { resumed: boolean; lastOrders: unknown[] },
): BluewaveDesktopBridge & { campaign: { execute: ReturnType<typeof vi.fn> } } {
  const execute = vi.fn<CampaignCommandClient["execute"]>(() =>
    startReply(VIEW, start.resumed, start.lastOrders),
  );
  const snapshot = { version: 1, app: { ...DEFAULT_APP_PREFERENCES, ...prefs } };
  return {
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
}

function mount(bridge: BluewaveDesktopBridge) {
  render(
    <BridgeProvider bridge={bridge}>
      <PreferencesProvider>
        <PlayerBattleScreen
          bridge={bridge}
          request={REQUEST}
          sessionId="s"
          onSubmitResult={() => {}}
          onAbandon={() => {}}
        />
      </PreferencesProvider>
    </BridgeProvider>,
  );
}

describe("PlayerBattleScreen", () => {
  afterEach(cleanup);

  it("shows visibility in the preferred measurement preset", async () => {
    mount(bridgeWith({ measurementPreset: "metric" }, { resumed: false, lastOrders: [] }));
    await waitFor(() => expect(screen.getByTestId("battle-weather").textContent).toContain("km"));
    cleanup();
    mount(bridgeWith({ measurementPreset: "imperial" }, { resumed: false, lastOrders: [] }));
    await waitFor(() => expect(screen.getByTestId("battle-weather").textContent).toContain("yd"));
  });

  it("marks damage with a symbol and word, not colour alone", async () => {
    mount(bridgeWith({}, { resumed: false, lastOrders: [] }));
    const row = await screen.findByTestId("battle-ship-s1");
    expect(row.textContent).toContain("CRIPPLED");
    expect(row.textContent).toContain("▼");
  });

  it("lists enemy ships that belong to no division instead of hiding them", async () => {
    const bridge = bridgeWith({}, { resumed: false, lastOrders: [] });
    const withEnemy: PlayerBattleView = {
      ...VIEW,
      ships: [
        ...VIEW.ships,
        { ...VIEW.ships[0]!, shipId: "e1", name: "FS Beta", sideId: "DEFENDER", divisionId: null },
      ],
    };
    bridge.campaign.execute.mockReturnValue(startReply(withEnemy, false, []));
    mount(bridge);
    const row = await screen.findByTestId("battle-ship-e1");
    expect(row.textContent).toContain("FS Beta");
  });

  it("restores the standing orders when a saved battle is resumed", async () => {
    mount(
      bridgeWith(
        {},
        { resumed: true, lastOrders: [{ divisionId: "d1", stance: "HOLD", speedPercent: 40 }] },
      ),
    );
    const stance = (await screen.findByLabelText("Stance for d1")) as HTMLSelectElement;
    expect(stance.value).toBe("HOLD");
    expect(screen.getByTestId("battle-resumed")).toBeTruthy();
  });
});
