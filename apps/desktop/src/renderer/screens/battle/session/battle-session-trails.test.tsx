import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import {
  BASE_VIEW,
  mountSession,
  ship,
  useBattleSessionSnapshot,
  type BattleSessionSnapshot,
} from "./battle-session-harness.js";

interface Frame {
  readonly minute: number | null;
  readonly alphaTrail: number | null;
}

const frames: Frame[] = [];
let session: BattleSessionSnapshot | null = null;

function Probe() {
  const value = useBattleSessionSnapshot();
  session = value;
  frames.push({
    minute: value.state.view?.minute ?? null,
    alphaTrail: value.state.trails["a1"]?.length ?? null,
  });
  return null;
}

const current = (): BattleSessionSnapshot => {
  if (session === null) throw new Error("probe not rendered");
  return session;
};

const MOVED: PlayerBattleView = {
  ...BASE_VIEW,
  minute: 1,
  ships: BASE_VIEW.ships.map((entry) =>
    entry.shipId === "a1" ? ship({ position: [1_000, 0] }) : entry,
  ),
};

describe("battle session trails", () => {
  afterEach(() => {
    cleanup();
    session = null;
    frames.length = 0;
  });

  it("never renders a new view with the trails of the previous one", async () => {
    mountSession(<Probe />, MOVED);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    act(() => current().actions.step());
    await waitFor(() => expect(current().state.view?.minute).toBe(1));
    const stale = frames.filter((frame) => frame.minute === 1 && frame.alphaTrail !== 2);
    expect(stale).toEqual([]);
    expect(current().state.trails["a1"]).toEqual([
      [0, 0],
      [1_000, 0],
    ]);
  });

  it("keeps the same trails object when only the viewport changes", async () => {
    mountSession(<Probe />);
    await waitFor(() => expect(current().state.view).not.toBeNull());
    const before = current().state.trails;
    act(() => current().actions.setViewport({ width: 900, height: 500 }));
    expect(current().state.trails).toBe(before);
  });
});
