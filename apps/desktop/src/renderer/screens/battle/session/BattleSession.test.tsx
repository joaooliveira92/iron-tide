import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { BluewaveDesktopBridge } from "../../../../preload/index.js";
import type { CampaignCommandClient } from "../../../../shared/campaign-contract.js";
import { DEFAULT_APP_PREFERENCES } from "../../../../shared/preferences-contract.js";
import { BridgeProvider } from "../../../lib/bridge-context.js";
import { PreferencesProvider } from "../../../lib/preferences-context.js";
import {
  BattleSessionProvider,
  useBattleSession,
  type BattleSessionValue,
} from "./BattleSession.js";

const NM_UM = 1_852_000_000;

const ship = (patch: Partial<PlayerBattleShipView>): PlayerBattleShipView => ({
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

const VIEW: PlayerBattleView = {
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

let session: BattleSessionValue | null = null;

function Probe() {
  session = useBattleSession();
  return null;
}

const current = (): BattleSessionValue => {
  if (session === null) throw new Error("probe not rendered");
  return session;
};

function mount() {
  const execute = vi.fn<CampaignCommandClient["execute"]>((command) => {
    const view = command === "advancePlayerBattle" ? { ...VIEW, minute: 1 } : VIEW;
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
          <Probe />
        </BattleSessionProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
  return { execute };
}

const advances = (execute: ReturnType<typeof mount>["execute"]) =>
  execute.mock.calls.filter(([command]) => command === "advancePlayerBattle");

describe("BattleSessionProvider", () => {
  afterEach(() => {
    cleanup();
    session = null;
  });

  it("loads the battle and starts paused with nothing selected", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    expect(current().state.running).toBe(false);
    expect(current().state.selectedShipId).toBeNull();
    expect(current().state.selectedPoint).toBeNull();
    expect(current().meta.areaId).toBe("channel");
  });

  it("selects a division's flagship and ignores an unknown division", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.selectDivision("d1"));
    expect(current().state.selectedShipId).toBe("a2");
    expect(current().state.selectedDivisionId).toBe("d1");
    act(() => current().actions.selectDivision("nope"));
    expect(current().state.selectedShipId).toBe("a2");
    act(() => current().actions.selectShip(null));
    expect(current().state.selected).toBeNull();
  });

  it("offers a course preview only for a selected ship", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.previewCourse(45));
    expect(current().state.preview).toBeNull();
    act(() => current().actions.selectShip("a1"));
    expect(current().state.preview).toEqual({ shipId: "a1", headingDeg: 45 });
    act(() => current().actions.previewCourse(null));
    expect(current().state.preview).toBeNull();
  });

  it("toggles overlays and the name filter independently", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.setOverlay("rings", false));
    act(() => current().actions.setNames("selected"));
    expect(current().state.overlays).toEqual({
      labels: "selected",
      tracks: true,
      rings: false,
      fire: true,
    });
  });

  it("steps one minute and fights to the end with the clock stopped", async () => {
    const { execute } = mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.toggleRunning());
    expect(current().state.running).toBe(true);
    act(() => current().actions.fightToEnd());
    expect(current().state.running).toBe(false);
    await waitFor(() => expect(advances(execute)).toHaveLength(1));
    expect(advances(execute)[0]?.[1]).toMatchObject({ mode: "to_end" });
    await waitFor(() => expect(current().state.busy).toBe(false));
    act(() => current().actions.step());
    await waitFor(() => expect(advances(execute)).toHaveLength(2));
    expect(advances(execute)[1]?.[1]).toMatchObject({ mode: "minute" });
  });

  it("zooms around the centre without freezing the automatic fit, unlike a map pan", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    const fitted = current().state.camera;
    act(() => current().actions.zoomIn());
    expect(current().state.camera.metresPerPixel).toBeLessThan(fitted.metresPerPixel);
    act(() => current().actions.fit());
    expect(current().state.camera.metresPerPixel).toBeCloseTo(fitted.metresPerPixel, 5);
    act(() => current().actions.changeCamera({ ...fitted, centreX: fitted.centreX + 1000 }));
    expect(current().state.camera.centreX).toBe(fitted.centreX + 1000);
  });

  it("focuses the camera on the selection only when there is one", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    const before = current().state.camera;
    act(() => current().actions.focus());
    expect(current().state.camera).toEqual(before);
    act(() => current().actions.selectShip("e1"));
    act(() => current().actions.focus());
    expect(current().state.camera.centreX).toBe(40 * NM_UM);
    expect(current().state.camera.centreY).toBe(10 * NM_UM);
  });

  it("keeps the standing orders it sends in step with what the player set", async () => {
    mount();
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.setOrder("d1", { courseDeg: 90, speedKnots: 10 }));
    expect(current().actions.orderFor("d1")).toMatchObject({ courseDeg: 90, speedKnots: 10 });
    act(() => current().actions.releaseCourse("d1"));
    expect(current().actions.orderFor("d1").courseDeg).toBeUndefined();
  });
});
