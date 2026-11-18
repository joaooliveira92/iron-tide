import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BattleMapPane } from "./BattleMapPane.js";
import {
  mountSession,
  useBattleSessionSnapshot,
  type BattleSessionSnapshot,
} from "./session/battle-session-harness.js";
import { rectangleCamera } from "./tactical/tactical-rectangle.js";
import { TACTICAL_MAX_M_PER_PX, TACTICAL_MIN_M_PER_PX } from "../tactical-map/tacticalScale.js";

let session: BattleSessionSnapshot | null = null;

function Probe() {
  session = useBattleSessionSnapshot();
  return null;
}

const current = (): BattleSessionSnapshot => {
  if (session === null) throw new Error("probe not rendered");
  return session;
};

const START = { centreX: 0, centreY: 0, metresPerPixel: 800 };
const map = (): HTMLElement => screen.getByTestId("tactical-map");
const rectangle = (): HTMLElement | null => screen.queryByTestId("tactical-zoom-rectangle");

const pointer = (x: number, y: number, shiftKey = false) => ({
  clientX: x,
  clientY: y,
  shiftKey,
  button: 0,
  pointerId: 1,
});

async function mountMap(): Promise<void> {
  mountSession(
    <>
      <Probe />
      <BattleMapPane />
    </>,
  );
  await screen.findByTestId("tactical-map");
  act(() => current().actions.changeCamera(START));
}

describe("tactical rectangle zoom", () => {
  afterEach(() => {
    cleanup();
    session = null;
  });

  it("draws the selection while shift-dragging and zooms to it on release", async () => {
    await mountMap();
    fireEvent.pointerDown(map(), pointer(100, 100, true));
    fireEvent.pointerMove(map(), pointer(300, 220, true));
    const drawn = rectangle();
    expect(drawn).not.toBeNull();
    expect(drawn?.getAttribute("width")).toBe("200");
    expect(drawn?.getAttribute("height")).toBe("120");
    expect(current().state.camera).toEqual(START);

    fireEvent.pointerUp(map(), pointer(300, 220, true));
    expect(rectangle()).toBeNull();
    expect(current().state.camera).toEqual(
      rectangleCamera(START, current().state.viewport, {
        left: 100,
        top: 100,
        width: 200,
        height: 120,
      }),
    );
    expect(current().state.camera.metresPerPixel).toBe(200);
  });

  it("accepts a rectangle dragged up and to the left", async () => {
    await mountMap();
    fireEvent.pointerDown(map(), pointer(300, 220, true));
    fireEvent.pointerMove(map(), pointer(100, 100, true));
    fireEvent.pointerUp(map(), pointer(100, 100, true));
    expect(current().state.camera.metresPerPixel).toBe(200);
  });

  it("cancels the rectangle on Escape without changing the camera or the selection", async () => {
    await mountMap();
    fireEvent.click(screen.getByTestId("tactical-ship-a1"));
    await waitFor(() => expect(current().state.selectedShipId).toBe("a1"));

    fireEvent.pointerDown(map(), pointer(100, 100, true));
    fireEvent.pointerMove(map(), pointer(300, 220, true));
    expect(rectangle()).not.toBeNull();
    fireEvent.keyDown(map(), { key: "Escape" });
    expect(rectangle()).toBeNull();
    fireEvent.pointerUp(map(), pointer(300, 220, true));

    expect(current().state.camera).toEqual(START);
    expect(current().state.selectedShipId).toBe("a1");
  });

  it("still pans on a plain drag and never draws a rectangle", async () => {
    await mountMap();
    fireEvent.pointerDown(map(), pointer(100, 100));
    fireEvent.pointerMove(map(), pointer(160, 130));
    expect(rectangle()).toBeNull();
    fireEvent.pointerUp(map(), pointer(160, 130));
    expect(current().state.camera.metresPerPixel).toBe(START.metresPerPixel);
    expect(current().state.camera.centreX).not.toBe(START.centreX);
  });

  it("ignores a shift-drag too small to be a deliberate rectangle", async () => {
    await mountMap();
    fireEvent.pointerDown(map(), pointer(100, 100, true));
    fireEvent.pointerMove(map(), pointer(106, 105, true));
    fireEvent.pointerUp(map(), pointer(106, 105, true));
    expect(current().state.camera).toEqual(START);
  });

  it("keeps shift-click selecting a ship and clearing the selection", async () => {
    await mountMap();
    fireEvent.click(screen.getByTestId("tactical-ship-a1"), { shiftKey: true });
    await waitFor(() => expect(current().state.selectedShipId).toBe("a1"));

    fireEvent.pointerDown(map(), pointer(500, 400, true));
    fireEvent.pointerUp(map(), pointer(500, 400, true));
    await waitFor(() => expect(current().state.selectedShipId).toBeNull());
    expect(current().state.camera).toEqual(START);
    expect(rectangle()).toBeNull();
  });

  it("stops following when a rectangle is framed", async () => {
    await mountMap();
    fireEvent.click(screen.getByTestId("tactical-ship-a1"));
    await waitFor(() => expect(current().state.selectedShipId).toBe("a1"));
    fireEvent.keyDown(map(), { key: "f" });
    expect(current().state.following).toBe(true);

    fireEvent.pointerDown(map(), pointer(100, 100, true));
    fireEvent.pointerMove(map(), pointer(300, 220, true));
    fireEvent.pointerUp(map(), pointer(300, 220, true));
    expect(current().state.following).toBe(false);
    expect(current().state.camera.metresPerPixel).toBe(200);
  });

  it("zooms with the Z and X hotkeys inside the unchanged 50 to 1600 range", async () => {
    await mountMap();
    fireEvent.keyDown(map(), { key: "z" });
    expect(current().state.camera.metresPerPixel).toBeLessThan(START.metresPerPixel);
    fireEvent.keyDown(map(), { key: "X" });
    expect(current().state.camera.metresPerPixel).toBeCloseTo(START.metresPerPixel, 6);

    for (let index = 0; index < 20; index += 1) fireEvent.keyDown(map(), { key: "z" });
    expect(current().state.camera.metresPerPixel).toBe(TACTICAL_MIN_M_PER_PX);
    for (let index = 0; index < 30; index += 1) fireEvent.keyDown(map(), { key: "x" });
    expect(current().state.camera.metresPerPixel).toBe(TACTICAL_MAX_M_PER_PX);
  });

  it("leaves Z and X to the browser when a command modifier is held", async () => {
    await mountMap();
    fireEvent.keyDown(map(), { key: "z", ctrlKey: true });
    fireEvent.keyDown(map(), { key: "x", metaKey: true });
    expect(current().state.camera).toEqual(START);
  });
});
