import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BattleMapPane } from "./BattleMapPane.js";
import { BattleToolbar } from "./BattleToolbar.js";
import { mountSession } from "./session/battle-session-harness.js";

const follow = (): HTMLButtonElement => screen.getByTestId("tactical-follow") as HTMLButtonElement;

describe("tactical follow toggle", () => {
  afterEach(cleanup);

  it("is reachable by button and the F key, and its label explains the state", async () => {
    mountSession(
      <>
        <BattleToolbar />
        <BattleMapPane />
      </>,
    );
    await screen.findByTestId("tactical-map");
    expect(follow().disabled).toBe(true);
    expect(follow().title).toBe("Select a ship with a known position to follow it.");

    fireEvent.click(screen.getByTestId("tactical-ship-a1"));
    await waitFor(() => expect(follow().disabled).toBe(false));
    expect(follow().getAttribute("aria-pressed")).toBe("false");
    expect(follow().textContent).toBe("Follow selection");

    fireEvent.click(follow());
    expect(follow().getAttribute("aria-pressed")).toBe("true");
    expect(follow().textContent).toBe("Following selection");
    expect(follow().title).toContain("locked on the selected division");

    const map = screen.getByTestId("tactical-map");
    fireEvent.keyDown(map, { key: "f" });
    expect(follow().getAttribute("aria-pressed")).toBe("false");
    fireEvent.keyDown(map, { key: "F" });
    expect(follow().getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    expect(follow().getAttribute("aria-pressed")).toBe("false");
  });
});
