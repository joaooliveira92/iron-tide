import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import { translate } from "../../../lib/strings.js";
import { BattleBoard } from "../BattleBoard.js";
import { AccuracyDisclosure } from "../AccuracyDisclosure.js";
import { useBattleSession, type BattleSessionValue } from "./BattleSession.js";
import { BASE_VIEW, mountSession, ship } from "./battle-session-harness.js";

vi.mock("../../../lib/strings.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/strings.js")>();
  return { ...actual, translate: vi.fn(actual.translate) };
});

vi.mock("../AccuracyDisclosure.js", () => ({ AccuracyDisclosure: vi.fn(() => null) }));

const VIEW: PlayerBattleView = {
  ...BASE_VIEW,
  ships: BASE_VIEW.ships.map((entry) =>
    entry.shipId === "a1"
      ? ship({
          gunneryAccuracy: {
            formulaId: "gunnery_accuracy",
            formulaVersion: "v1",
            inputs: {},
            intermediate: {},
            result: 1,
            unit: "bp",
          },
        })
      : entry,
  ),
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

const renders = (key: string): number =>
  vi.mocked(translate).mock.calls.filter(([candidate]) => candidate === key).length;

const toolbarRenders = () => renders("tactical.toolbar.label");
const unitPanelRenders = () => renders("tactical.unit.title");
const oobRenders = () => vi.mocked(AccuracyDisclosure).mock.calls.length;

async function mountBoard() {
  const handle = mountSession(
    <>
      <Probe />
      <BattleBoard />
    </>,
    VIEW,
    VIEW,
  );
  await waitFor(() => expect(screen.getByTestId("tactical-map")).toBeTruthy());
  act(() => current().actions.selectShip("a1"));
  return handle;
}

describe("battle sidebar and toolbar render stability", () => {
  afterEach(() => {
    cleanup();
    session = null;
    vi.mocked(translate).mockClear();
    vi.mocked(AccuracyDisclosure).mockClear();
  });

  it("leaves the toolbar, order of battle and unit panel alone while the map pans and zooms", async () => {
    await mountBoard();
    const camera = current().state.camera;
    const before = [toolbarRenders(), oobRenders(), unitPanelRenders()];
    expect(before.every((count) => count > 0)).toBe(true);
    act(() => current().actions.changeCamera({ ...camera, centreX: camera.centreX + 500 }));
    act(() => current().actions.changeCamera({ ...camera, centreX: camera.centreX + 900 }));
    expect([toolbarRenders(), oobRenders(), unitPanelRenders()]).toEqual(before);
  });

  it("still re-renders the toolbar when an overlay it shows changes", async () => {
    await mountBoard();
    const before = toolbarRenders();
    act(() => current().actions.setOverlay("rings", false));
    expect(toolbarRenders()).toBeGreaterThan(before);
  });

  it("still re-renders the order of battle when a division order changes", async () => {
    await mountBoard();
    const before = oobRenders();
    fireEvent.change(screen.getByLabelText("Stance for d1"), { target: { value: "WITHDRAW" } });
    expect(oobRenders()).toBeGreaterThan(before);
  });
});
