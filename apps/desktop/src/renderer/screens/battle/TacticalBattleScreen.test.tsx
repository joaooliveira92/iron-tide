import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type { CampaignCommandClient } from "../../../shared/campaign-contract.js";
import { DEFAULT_APP_PREFERENCES } from "../../../shared/preferences-contract.js";
import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
import { axeViolations } from "../../lib/axe.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { PreferencesProvider } from "../../lib/preferences-context.js";
import { PlayerBattleScreen } from "./PlayerBattleScreen.js";
import { stepIntervalMs } from "./tactical/tactical-time.js";

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

const BASE: PlayerBattleView = {
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
  objectives: ["Destroy the enemy squadron"],
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
      speedBp: 10_000,
      contactConfidenceBp: 9_000,
    }),
  ],
  divisions: [
    {
      divisionId: "d1",
      sideId: "ATTACKER",
      role: "BATTLE_LINE",
      formation: "LINE_AHEAD",
      flagshipId: "a1",
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

function reply(view: PlayerBattleView) {
  return Promise.resolve({
    outcome: "success",
    value: { view, sessionHash: "h", resumed: false, lastOrders: [], result: null },
    diagnostics: [],
  } as never);
}

function mount(initial: PlayerBattleView = BASE) {
  let current = initial;
  const execute = vi.fn<CampaignCommandClient["execute"]>((command) => {
    if (command === "advancePlayerBattle") {
      current = { ...current, minute: current.minute + 1 };
    }
    return reply(current);
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
  const utils = render(
    <BridgeProvider bridge={bridge}>
      <PreferencesProvider>
        <PlayerBattleScreen
          request={REQUEST}
          sessionId="s"
          onSubmitResult={() => {}}
          onAbandon={() => {}}
        />
      </PreferencesProvider>
    </BridgeProvider>,
  );
  return { execute, setView: (view: PlayerBattleView) => (current = view), ...utils };
}

const advances = (execute: ReturnType<typeof mount>["execute"]) =>
  execute.mock.calls.filter(([command]) => command === "advancePlayerBattle");

describe("tactical battle screen", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens paused with a prominent state and advances nothing on its own", async () => {
    vi.useFakeTimers();
    const { execute } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("tactical-run-state").textContent).toBe("PAUSED");
    expect(screen.getByTestId("tactical-paused-banner")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(advances(execute)).toHaveLength(0);
    expect(screen.getByTestId("tactical-elapsed").textContent).toContain("00:00");
  });

  it("steps one minute per interval while running and stops when paused", async () => {
    vi.useFakeTimers();
    const { execute } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByTestId("tactical-run-toggle"));
    expect(screen.getByTestId("tactical-run-state").textContent).toBe("Running at 1×");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(stepIntervalMs(1));
    });
    expect(advances(execute)).toHaveLength(1);
    expect(advances(execute)[0]?.[1]).toMatchObject({ mode: "minute" });
    fireEvent.click(screen.getByTestId("tactical-run-toggle"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(advances(execute)).toHaveLength(1);
    expect(screen.getByTestId("tactical-run-state").textContent).toBe("PAUSED");
  });

  it("changes only how often it asks for a step, never what a step is", async () => {
    vi.useFakeTimers();
    const { execute } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByTestId("tactical-speed-8"));
    fireEvent.click(screen.getByTestId("tactical-run-toggle"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(stepIntervalMs(8));
    });
    expect(advances(execute)).toHaveLength(1);
    expect(advances(execute)[0]?.[1]).toMatchObject({ mode: "minute" });
    expect(screen.getByTestId("tactical-speed-8").getAttribute("aria-pressed")).toBe("true");
  });

  it("selects a ship from the map and shows its real heading and speed", async () => {
    mount();
    const own = await screen.findByTestId("tactical-ship-a1");
    fireEvent.click(own);
    const panel = screen.getByTestId("unit-panel");
    expect(within(panel).getByText(/Selected: HMS Alpha/)).toBeTruthy();
    expect(screen.getByTestId("unit-course-now").textContent).toBe("000°");
    expect(screen.getByTestId("unit-speed-now").textContent).toBe("12.0 kn");
    expect(screen.getByTestId("tactical-selection")).toBeTruthy();
  });

  it("selects with the keyboard", async () => {
    mount();
    const own = await screen.findByTestId("tactical-ship-a2");
    fireEvent.keyDown(own, { key: "Enter" });
    expect(within(screen.getByTestId("unit-panel")).getByText(/Selected: HMS Bravo/)).toBeTruthy();
    expect(own.getAttribute("aria-pressed")).toBe("true");
  });

  it("selecting a division in the order of battle selects its flagship", async () => {
    mount();
    fireEvent.click(await screen.findByLabelText("Select division d1"));
    expect(within(screen.getByTestId("unit-panel")).getByText(/Selected: HMS Alpha/)).toBeTruthy();
  });

  it("gives a hostile contact no order controls", async () => {
    mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-e1"));
    const panel = screen.getByTestId("unit-panel");
    expect(within(panel).getByText(/hostile contact; it takes no orders/)).toBeTruthy();
    expect(screen.queryByTestId("unit-course-input")).toBeNull();
  });

  it("shows a course order as pending, then in effect once a step carries it", async () => {
    const { execute } = mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "090" } });
    fireEvent.change(screen.getByTestId("unit-speed-input"), { target: { value: "14" } });
    expect(screen.getByTestId("tactical-course-preview")).toBeTruthy();
    fireEvent.click(screen.getByTestId("unit-apply"));
    expect(screen.getByTestId("unit-order-state").getAttribute("data-state")).toBe("pending");
    expect(screen.getByTestId("unit-course-requested").textContent).toBe("090°");
    expect(screen.getByTestId("unit-speed-requested").textContent).toBe("14 kn");
    expect(advances(execute)).toHaveLength(0);

    fireEvent.click(screen.getByTestId("battle-advance"));
    await waitFor(() =>
      expect(screen.getByTestId("unit-order-state").getAttribute("data-state")).toBe("accepted"),
    );
    expect(advances(execute)[0]?.[1]).toMatchObject({
      divisions: [expect.objectContaining({ divisionId: "d1", courseDeg: 0, speedKnots: 14 })],
    });
  });

  it("refuses a malformed course and speed before anything is sent", async () => {
    const { execute } = mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "400" } });
    fireEvent.change(screen.getByTestId("unit-speed-input"), { target: { value: "0" } });
    expect((screen.getByTestId("unit-apply") as HTMLButtonElement).disabled).toBe(true);
    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts.join(" ")).toContain("Course must be a whole number from 0 to 359.");
    expect(alerts.join(" ")).toContain("Speed must be a whole number from 1 to 60 knots.");
    expect(advances(execute)).toHaveLength(0);
  });

  it("keeps a pending order and shows the typed refusal when the step is rejected", async () => {
    const { execute } = mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "045" } });
    fireEvent.change(screen.getByTestId("unit-speed-input"), { target: { value: "9" } });
    fireEvent.click(screen.getByTestId("unit-apply"));
    execute.mockReturnValueOnce(
      Promise.resolve({ outcome: "error", reason: "PLAYER_BATTLE_NOT_STARTED", diagnostics: [] }),
    );
    fireEvent.click(screen.getByTestId("battle-advance"));
    expect((await screen.findByTestId("battle-error")).textContent).toContain(
      "PLAYER_BATTLE_NOT_STARTED",
    );
    expect(screen.getByTestId("unit-order-state").getAttribute("data-state")).toBe("pending");
  });

  it("releases a standing course back to the division stance", async () => {
    mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "180" } });
    fireEvent.change(screen.getByTestId("unit-speed-input"), { target: { value: "8" } });
    fireEvent.click(screen.getByTestId("unit-apply"));
    fireEvent.click(screen.getByTestId("unit-release"));
    expect(screen.queryByTestId("unit-course-requested")).toBeNull();
  });

  it("lists the combat log in stable order with structured categories", async () => {
    const withLog: PlayerBattleView = {
      ...BASE,
      minute: 3,
      log: [
        { minute: 1, eventType: "contact_created", actorId: "obs-b1:e1", targetId: "b1:e1" },
        { minute: 2, eventType: "gunnery_salvo", actorId: "a1:MAIN", targetId: "b1:e1" },
        { minute: 2, eventType: "damage_impact", actorId: "a1:MAIN", targetId: "e1" },
        { minute: 3, eventType: "resolve_movement_intent", actorId: "pipeline", targetId: "" },
      ],
    };
    mount(withLog);
    await screen.findByTestId("tactical-map");
    fireEvent.click(screen.getByRole("tab", { name: "Combat log" }));
    const rows = await screen.findAllByTestId("battle-log-entry");
    expect(rows.map((row) => row.getAttribute("data-category"))).toEqual([
      "battle",
      "contact",
      "fire",
      "damage",
    ]);
    const sequences = rows.map((row) => Number(row.getAttribute("data-sequence")));
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(rows[2]?.textContent).toContain("HMS Alpha opened fire on FS Corse.");
  });

  it("draws this minute's firing line and impact, and the overlay toggle hides them", async () => {
    const firing: PlayerBattleView = {
      ...BASE,
      minute: 2,
      log: [
        { minute: 2, eventType: "gunnery_salvo", actorId: "a1:MAIN", targetId: "b1:e1" },
        { minute: 2, eventType: "damage_impact", actorId: "a1:MAIN", targetId: "e1" },
      ],
    };
    mount(firing);
    await screen.findByTestId("tactical-map");
    expect(screen.getAllByTestId("tactical-firing-line")).toHaveLength(1);
    expect(screen.getAllByTestId("tactical-impact")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("tactical-overlay-fire"));
    expect(screen.queryByTestId("tactical-firing-line")).toBeNull();
    expect(screen.queryByTestId("tactical-impact")).toBeNull();
  });

  it("marks sunk and damaged ships by shape and state, not colour alone", async () => {
    mount({
      ...BASE,
      ships: [
        ship({}),
        ship({ shipId: "a2", name: "HMS Bravo", hitPoints: 20, position: [NM_UM, 0] }),
        ship({
          shipId: "a3",
          name: "HMS Charlie",
          damageState: "SINKING",
          position: [2 * NM_UM, 0],
        }),
      ],
      divisions: [{ ...BASE.divisions[0]!, unitIds: ["a1", "a2", "a3"] }, BASE.divisions[1]!],
    });
    expect((await screen.findByTestId("tactical-ship-a1")).getAttribute("data-status")).toBe(
      "operational",
    );
    expect(screen.getByTestId("tactical-ship-a2").getAttribute("data-status")).toBe("damaged");
    expect(screen.getByTestId("tactical-ship-a3").getAttribute("data-status")).toBe("sunk");
    expect(screen.getByTestId("tactical-ship-a3").getAttribute("aria-label")).toContain("sunk");
  });

  it("omits a hostile ship with no known position from the map but keeps it listed", async () => {
    mount({
      ...BASE,
      ships: [
        ...BASE.ships.slice(0, 2),
        ship({ ...BASE.ships[2]!, position: null, headingDeg: null, speedBp: null }),
      ],
    });
    await screen.findByTestId("tactical-map");
    expect(screen.queryByTestId("tactical-ship-e1")).toBeNull();
    expect(screen.getByText("FS Corse")).toBeTruthy();
  });

  it("shows the battle-complete state and stops the clock", async () => {
    mount({
      ...BASE,
      ended: true,
      endReason: "withdrawal_complete",
      winnerId: "uk",
      loserId: "france",
    });
    await screen.findByTestId("tactical-map");
    expect(screen.getByTestId("tactical-run-state").textContent).toBe("Battle over");
    expect((screen.getByTestId("tactical-run-toggle") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("tactical-paused-banner")).toBeNull();
    expect(screen.getByTestId("battle-outcome").textContent).toContain("Winner: uk");
  });

  it("lists objectives only when the battle has them", async () => {
    mount();
    await screen.findByTestId("tactical-map");
    fireEvent.click(screen.getByRole("tab", { name: "Objectives" }));
    expect((await screen.findByTestId("battle-objectives")).textContent).toContain(
      "Destroy the enemy squadron",
    );
    cleanup();
    mount({ ...BASE, objectives: [] });
    await screen.findByTestId("tactical-map");
    expect(screen.queryByRole("tab", { name: "Objectives" })).toBeNull();
  });

  it("zooms and fits from the toolbar and enables focus only with a selection", async () => {
    mount();
    await screen.findByTestId("tactical-map");
    const spread = () =>
      Number(
        /translate\((-?[\d.]+)px/u.exec(
          screen.getByTestId("tactical-ship-e1").getAttribute("style") ?? "",
        )?.[1],
      ) -
      Number(
        /translate\((-?[\d.]+)px/u.exec(
          screen.getByTestId("tactical-ship-a1").getAttribute("style") ?? "",
        )?.[1],
      );
    const initial = spread();
    fireEvent.click(screen.getByTestId("tactical-zoom-in"));
    expect(spread()).toBeGreaterThan(initial);
    fireEvent.click(screen.getByTestId("tactical-zoom-out"));
    fireEvent.click(screen.getByTestId("tactical-zoom-out"));
    expect(spread()).toBeLessThan(initial);
    fireEvent.click(screen.getByTestId("tactical-fit"));
    expect(spread()).toBeCloseTo(initial, 0);
    expect((screen.getByTestId("tactical-focus") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("tactical-ship-a1"));
    expect((screen.getByTestId("tactical-focus") as HTMLButtonElement).disabled).toBe(false);
  });

  const translateX = (id: string): number =>
    Number(
      /translate\((-?[\d.]+)px/u.exec(
        screen.getByTestId(`tactical-ship-${id}`).getAttribute("style") ?? "",
      )?.[1],
    );

  const withoutContact: PlayerBattleView = {
    ...BASE,
    ships: BASE.ships.map((entry) =>
      entry.shipId === "e1" ? { ...entry, position: null, headingDeg: null, speedBp: null } : entry,
    ),
  };

  it("refits the map when a hostile contact appears and the player has not moved it", async () => {
    const { setView } = mount(withoutContact);
    await screen.findByTestId("tactical-ship-a1");
    setView(BASE);
    fireEvent.click(screen.getByTestId("battle-advance"));
    const hostile = await screen.findByTestId("tactical-ship-e1");
    expect(hostile).toBeTruthy();
    await waitFor(() => {
      expect(translateX("e1")).toBeGreaterThan(0);
      expect(translateX("e1")).toBeLessThan(800);
    });
  });

  it("refits once when the battle ends so the survivors are on screen", async () => {
    const far: PlayerBattleView = {
      ...BASE,
      ships: BASE.ships.map((entry) =>
        entry.shipId === "a1" ? { ...entry, position: [900 * NM_UM, 0] } : entry,
      ),
    };
    const { setView } = mount();
    await screen.findByTestId("tactical-ship-a1");
    setView({ ...far, ended: true, endReason: "withdrawal_complete" });
    fireEvent.click(screen.getByTestId("battle-advance"));
    await waitFor(() => {
      expect(translateX("a1")).toBeGreaterThan(0);
      expect(translateX("a1")).toBeLessThan(800);
    });
  });

  it("leaves the camera alone once the player has moved it", async () => {
    const { setView } = mount(withoutContact);
    const map = await screen.findByTestId("tactical-map");
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    const before = translateX("a1");
    setView(BASE);
    fireEvent.click(screen.getByTestId("battle-advance"));
    await screen.findByTestId("tactical-ship-e1");
    expect(translateX("a1")).toBe(before);
  });

  it("pans and zooms the map from the keyboard", async () => {
    mount();
    const map = await screen.findByTestId("tactical-map");
    const before = screen.getByTestId("tactical-ship-a1").getAttribute("style");
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    expect(screen.getByTestId("tactical-ship-a1").getAttribute("style")).not.toBe(before);
    fireEvent.keyDown(map, { key: "Escape" });
    expect(screen.queryByTestId("tactical-selection")).toBeNull();
  });

  it("asks for no further step once it unmounts", async () => {
    vi.useFakeTimers();
    const { execute, unmount } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByTestId("tactical-run-toggle"));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(advances(execute)).toHaveLength(0);
  });

  it("filters ship names to all, the selection only, or none", async () => {
    mount();
    await screen.findByTestId("tactical-map");
    const shown = screen.getAllByTestId(/^tactical-label-/u).length;
    expect(shown).toBeGreaterThanOrEqual(2);
    expect(shown).toBeLessThan(3);
    fireEvent.change(screen.getByTestId("tactical-names"), { target: { value: "none" } });
    expect(screen.queryAllByTestId(/^tactical-label-/u)).toHaveLength(0);
    fireEvent.change(screen.getByTestId("tactical-names"), { target: { value: "selected" } });
    fireEvent.click(screen.getByTestId("tactical-ship-a2"));
    const labels = screen.getAllByTestId(/^tactical-label-/u);
    expect(labels).toHaveLength(1);
    expect(labels[0]?.textContent).toBe("HMS Bravo");
  });

  it("reports sea, sky, daylight and visibility on the map", async () => {
    mount();
    await screen.findByTestId("tactical-map");
    const conditions = screen.getByTestId("tactical-conditions");
    expect(conditions.textContent).toContain("Sea: moderate");
    expect(conditions.textContent).toContain("Weather: clear");
    expect(conditions.textContent).toContain("Day");
    expect(screen.getByTestId("battle-weather").textContent).toContain("Visibility:");
  });

  it("measures the distance from the selected ship to the cursor", async () => {
    mount();
    const map = await screen.findByTestId("tactical-map");
    expect(screen.queryByTestId("tactical-cursor-distance")).toBeNull();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    fireEvent.pointerMove(map, { clientX: 300, clientY: 200 });
    expect(screen.getByTestId("tactical-cursor-distance").textContent).toMatch(
      /Distance to cursor: .+/u,
    );
    fireEvent.pointerLeave(map);
    expect(screen.queryByTestId("tactical-cursor-distance")).toBeNull();
  });

  it("plots a standing course line once a course order is in effect", async () => {
    mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    expect(screen.queryByTestId("tactical-standing-course")).toBeNull();
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "090" } });
    fireEvent.change(screen.getByTestId("unit-speed-input"), { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("unit-apply"));
    expect(screen.queryByTestId("tactical-standing-course")).toBeNull();
    fireEvent.click(screen.getByTestId("battle-advance"));
    expect(await screen.findByTestId("tactical-standing-course")).toBeTruthy();
  });

  it("passes an automated accessibility audit", async () => {
    mount();
    fireEvent.click(await screen.findByTestId("tactical-ship-a1"));
    const violations = await axeViolations(screen.getByTestId("player-battle"));
    expect(violations.filter((violation) => !violation.startsWith("region "))).toEqual([]);
  });
});

beforeEach(() => {
  vi.useRealTimers();
});
