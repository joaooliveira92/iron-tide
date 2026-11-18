import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  BASE_VIEW,
  NM_UM,
  mountSession,
  ship,
  useBattleSessionSnapshot,
  type BattleSessionSnapshot,
} from "./battle-session-harness.js";
import { fitCamera } from "../tactical/tactical-geometry.js";
import { knownPositions } from "../tactical/tactical-model.js";
import { rectangleCamera } from "../tactical/tactical-rectangle.js";

let session: BattleSessionSnapshot | null = null;

function Probe() {
  session = useBattleSessionSnapshot();
  return null;
}

const current = (): BattleSessionSnapshot => {
  if (session === null) throw new Error("probe not rendered");
  return session;
};

const MEASURED = { width: 900, height: 500 };

describe("battle camera follow", () => {
  afterEach(() => {
    cleanup();
    session = null;
  });

  const MOVED_VIEW = {
    ...BASE_VIEW,
    minute: 1,
    ships: BASE_VIEW.ships.map((candidate) =>
      candidate.shipId === "a2" ? ship({ ...candidate, position: [3 * NM_UM, NM_UM] }) : candidate,
    ),
  };

  it("keeps the selected division centred through a tick and stops on a pan", async () => {
    mountSession(<Probe />, MOVED_VIEW);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.selectDivision("d1"));
    act(() => current().actions.toggleFollow());
    await waitFor(() => expect(current().state.following).toBe(true));
    expect(current().state.camera.centreX).toBe(-NM_UM / 4);

    act(() => current().actions.step());
    await waitFor(() => expect(current().state.view?.minute).toBe(1));
    expect(current().state.camera.centreX).toBe(3 * NM_UM);
    expect(current().state.camera.centreY).toBe(NM_UM);

    const panned = { ...current().state.camera, centreX: 0 };
    act(() => current().actions.changeCamera(panned));
    expect(current().state.following).toBe(false);
    expect(current().state.camera).toEqual(panned);
  });

  it("keeps following through a zoom and turns off on request", async () => {
    mountSession(<Probe />, MOVED_VIEW);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.selectDivision("d1"));
    act(() => current().actions.toggleFollow());
    await waitFor(() => expect(current().state.following).toBe(true));
    act(() => current().actions.zoomIn());
    expect(current().state.following).toBe(true);
    expect(current().state.camera.centreX).toBe(-NM_UM / 4);
    act(() => current().actions.toggleFollow());
    expect(current().state.following).toBe(false);
  });
});

describe("battle camera rectangle zoom", () => {
  afterEach(() => {
    cleanup();
    session = null;
  });

  const RECTANGLE = { left: 300, top: 100, width: 200, height: 120 };

  it("frames the rectangle and stops following the selected division", async () => {
    mountSession(<Probe />);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.selectDivision("d1"));
    act(() => current().actions.toggleFollow());
    await waitFor(() => expect(current().state.following).toBe(true));
    const before = current().state.camera;

    act(() => current().actions.zoomToRectangle(RECTANGLE));
    expect(current().state.following).toBe(false);
    expect(current().state.camera.centreY).not.toBe(before.centreY);
    expect(current().state.camera).toEqual(
      rectangleCamera(before, current().state.viewport, RECTANGLE),
    );
  });

  it("keeps the camera the player framed through a viewport change", async () => {
    mountSession(<Probe />);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.zoomToRectangle(RECTANGLE));
    const framed = current().state.camera;
    act(() => current().actions.setViewport(MEASURED));
    expect(current().state.camera).toEqual(framed);
  });
});

describe("battle camera auto-fit", () => {
  afterEach(() => {
    cleanup();
    session = null;
  });

  it("refits to the measured viewport when it differs from the fallback", async () => {
    mountSession(<Probe />);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.setViewport(MEASURED));
    await waitFor(() =>
      expect(current().state.camera).toEqual(
        fitCamera(knownPositions(BASE_VIEW), MEASURED, current().state.camera),
      ),
    );
  });

  it("does not refit a camera the user has already moved", async () => {
    mountSession(<Probe />);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    const moved = { centreX: 5_000, centreY: 5_000, metresPerPixel: 100 };
    act(() => current().actions.changeCamera(moved));
    act(() => current().actions.setViewport(MEASURED));
    expect(current().state.camera).toEqual(moved);
  });
});
