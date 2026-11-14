import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  BASE_VIEW,
  mountSession,
  useBattleSessionSnapshot,
  type BattleSessionSnapshot,
} from "./battle-session-harness.js";
import { fitCamera } from "../tactical/tactical-geometry.js";
import { knownPositions } from "../tactical/tactical-model.js";

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
