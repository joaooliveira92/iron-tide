import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  useBattleActions,
  useBattleState,
  type BattleSessionActions,
} from "./battle-session-contexts.js";
import {
  BASE_VIEW,
  mountSession,
  useBattleSessionSnapshot,
  type BattleSessionSnapshot,
} from "./battle-session-harness.js";

let actionRenders = 0;
let stateRenders = 0;
let latest: BattleSessionSnapshot | null = null;
let firstActions: BattleSessionActions | null = null;

function ActionsOnlyProbe() {
  const actions = useBattleActions();
  actionRenders += 1;
  firstActions ??= actions;
  return null;
}

function StateOnlyProbe() {
  useBattleState();
  stateRenders += 1;
  return null;
}

function SessionProbe() {
  latest = useBattleSessionSnapshot();
  return null;
}

const session = (): BattleSessionSnapshot => {
  if (latest === null) throw new Error("probe not rendered");
  return latest;
};

async function mountProbes() {
  mountSession(
    <>
      <ActionsOnlyProbe />
      <SessionProbe />
    </>,
  );
  await waitFor(() => expect(session().state.view).not.toBeNull());
}

describe("battle session contexts", () => {
  afterEach(() => {
    cleanup();
    actionRenders = 0;
    stateRenders = 0;
    latest = null;
    firstActions = null;
  });

  it("does not re-render an actions-only consumer on camera updates", async () => {
    await mountProbes();
    const before = actionRenders;
    const camera = session().state.camera;
    act(() => session().actions.changeCamera({ ...camera, centreX: camera.centreX + 500 }));
    act(() => session().actions.changeCamera({ ...camera, centreX: camera.centreX + 900 }));
    expect(session().state.camera.centreX).toBe(camera.centreX + 900);
    expect(actionRenders).toBe(before);
  });

  it("does not re-render a state-only consumer on camera updates", async () => {
    mountSession(
      <>
        <StateOnlyProbe />
        <SessionProbe />
      </>,
    );
    await waitFor(() => expect(session().state.view).not.toBeNull());
    const before = stateRenders;
    const camera = session().state.camera;
    act(() => session().actions.changeCamera({ ...camera, centreX: camera.centreX + 700 }));
    expect(stateRenders).toBe(before);
    act(() => session().actions.setOverlay("rings", false));
    expect(stateRenders).toBeGreaterThan(before);
  });

  it("does not re-render an actions-only consumer on selection or overlay changes", async () => {
    await mountProbes();
    const before = actionRenders;
    act(() => session().actions.selectShip("a1"));
    act(() => session().actions.setOverlay("rings", false));
    expect(actionRenders).toBe(before);
  });

  it("keeps action identities stable and current across state changes", async () => {
    await mountProbes();
    const first = session().actions;
    act(() => first.selectShip("e1"));
    act(() => first.zoomIn());
    act(() => session().actions.changeCamera({ centreX: 0, centreY: 0, metresPerPixel: 400 }));
    act(() => first.focus());
    expect(session().actions).toBe(first);
    expect(firstActions).toBe(first);
    const e1 = BASE_VIEW.ships.find((entry) => entry.shipId === "e1");
    expect(e1?.position).toBeDefined();
    expect(session().state.camera.centreX).toBe(e1?.position?.[0]);
    expect(session().state.camera.centreY).toBe(e1?.position?.[1]);
  });
});
