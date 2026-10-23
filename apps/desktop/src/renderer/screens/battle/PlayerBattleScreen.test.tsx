import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type { CampaignCommandClient } from "../../../shared/campaign-contract.js";
import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
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
  weather: {
    seaState: "MODERATE",
    visibilityNm: 10,
    precipitation: "CLEAR",
    daylight: true,
  },
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
  const snapshot = {
    version: 1,
    app: { ...DEFAULT_APP_PREFERENCES, ...prefs },
  };
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

function mount(bridge: BluewaveDesktopBridge, onSubmitResult: () => void = () => {}) {
  render(
    <BridgeProvider bridge={bridge}>
      <PreferencesProvider>
        <PlayerBattleScreen
          request={REQUEST}
          sessionId="s"
          onSubmitResult={onSubmitResult}
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
        {
          ...VIEW.ships[0]!,
          shipId: "e1",
          name: "FS Beta",
          sideId: "DEFENDER",
          divisionId: null,
        },
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
        {
          resumed: true,
          lastOrders: [{ divisionId: "d1", stance: "HOLD", speedPercent: 40 }],
        },
      ),
    );
    const stance = (await screen.findByLabelText("Stance for d1")) as HTMLSelectElement;
    expect(stance.value).toBe("HOLD");
    expect(screen.getByTestId("battle-resumed")).toBeTruthy();
  });

  it("shows the load refusal and no resume note", async () => {
    const bridge = bridgeWith({}, { resumed: false, lastOrders: [] });
    bridge.campaign.execute.mockReturnValue(
      Promise.resolve({ outcome: "error", reason: "NO_PENDING_TURN", diagnostics: [] }),
    );
    mount(bridge);
    expect((await screen.findByTestId("battle-error")).textContent).toContain("NO_PENDING_TURN");
    expect(screen.queryByTestId("battle-resumed")).toBeNull();
  });

  it("does not claim a resume for a fresh battle", async () => {
    mount(bridgeWith({}, { resumed: false, lastOrders: [] }));
    await screen.findByTestId("battle-status");
    expect(screen.queryByTestId("battle-resumed")).toBeNull();
  });

  it("sends the standing orders when advancing a minute and shows the new view", async () => {
    const bridge = bridgeWith(
      {},
      { resumed: true, lastOrders: [{ divisionId: "d1", stance: "HOLD", speedPercent: 40 }] },
    );
    mount(bridge);
    const advance = await screen.findByTestId("battle-advance");
    bridge.campaign.execute.mockReturnValue(
      Promise.resolve({
        outcome: "success",
        value: { view: { ...VIEW, minute: 4 }, sessionHash: "h2", result: null },
        diagnostics: [],
      } as never),
    );
    fireEvent.click(advance);
    await waitFor(() => expect(screen.getByText(/minute 4 \/ 120/)).toBeTruthy());
    expect(bridge.campaign.execute).toHaveBeenLastCalledWith("advancePlayerBattle", {
      sessionId: "s",
      battleId: "b1",
      mode: "minute",
      divisions: [{ divisionId: "d1", stance: "HOLD", speedPercent: 40 }],
    });
  });

  it("shows an advance refusal and keeps the battle on screen", async () => {
    const bridge = bridgeWith({}, { resumed: false, lastOrders: [] });
    mount(bridge);
    const advance = await screen.findByTestId("battle-advance");
    bridge.campaign.execute.mockReturnValue(
      Promise.resolve({ outcome: "error", reason: "PLAYER_BATTLE_NOT_STARTED", diagnostics: [] }),
    );
    fireEvent.click(advance);
    expect((await screen.findByTestId("battle-error")).textContent).toContain(
      "PLAYER_BATTLE_NOT_STARTED",
    );
    expect(screen.getByTestId("battle-status")).toBeTruthy();
  });

  it("submits the result of an ended battle", async () => {
    const ended: PlayerBattleView = { ...VIEW, ended: true, endReason: "ANNIHILATION" };
    const bridge = bridgeWith({}, { resumed: false, lastOrders: [] });
    bridge.campaign.execute.mockReturnValue(startReply(ended, false, []));
    const onSubmitResult = vi.fn();
    mount(bridge, onSubmitResult);
    const submit = await screen.findByTestId("battle-submit");
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    const result = {
      battleId: "b1",
      winnerId: "uk",
      loserId: "france",
      attackerLosses: [],
      defenderLosses: [],
      damageReport: {},
    };
    bridge.campaign.execute.mockReturnValue(
      Promise.resolve({ outcome: "success", value: { result }, diagnostics: [] } as never),
    );
    fireEvent.click(submit);
    await waitFor(() => expect(onSubmitResult).toHaveBeenCalledWith(result));
  });
});
