import type { DesignDraft } from "@bluewave/ship-design";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { createSelectionStore } from "../../selection/store.js";
import { ShipSelectionProvider } from "../../selection/useShipSelection.js";
import { planFrame } from "./geometry.js";
import { FittingTargets, type FittingTarget } from "./FittingTargets.js";

const frame = planFrame({ lengthWl: 100_000, beam: 14_000 } as never);
const draft = {
  placements: [
    {
      instanceId: "b",
      componentId: "gun_b",
      zoneId: "AFT_SERVICE",
      stationPermille: 800,
      side: "PORT",
    },
    { instanceId: "a", componentId: "gun_a", zoneId: "FORECASTLE", stationPermille: 100 },
  ],
} as unknown as DesignDraft;
const targets = new Map<string, FittingTarget>([
  ["a", { instanceId: "a", name: "Gun A", mount: "A" }],
  ["b", { instanceId: "b", name: "Gun B", mount: undefined }],
]);
const draw = (
  over: Partial<Parameters<typeof FittingTargets>[0]> = {},
  store = createSelectionStore(),
) =>
  render(
    <ShipSelectionProvider store={store}>
      <FittingTargets
        frame={frame}
        draft={draft}
        targets={targets}
        disabled={false}
        warns={() => false}
        {...over}
      />
    </ShipSelectionProvider>,
  );

const buttons = (container: HTMLElement) => Array.from(container.querySelectorAll("[data-target]"));

describe("FittingTargets", () => {
  it("is a labelled toolbar of buttons, one per fitting, ordered bow to stern", () => {
    const { container } = draw();
    expect(container.querySelector("[role='toolbar']")!.getAttribute("aria-label")).toBe(
      "Fittings on the plan",
    );
    expect(buttons(container).map((g) => g.getAttribute("data-target"))).toEqual(["a", "b"]);
    expect(buttons(container)[0]!.getAttribute("aria-label")).toBe(
      "Gun A (mount A), centreline, 100‰",
    );
    expect(buttons(container)[1]!.getAttribute("aria-label")).toBe("Gun B, port, 800‰");
  });

  it("keeps a single tab stop, moving it with the arrow keys and Home/End", () => {
    const { container } = draw();
    const [first, second] = buttons(container);
    expect(first!.getAttribute("tabindex")).toBe("0");
    expect(second!.getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(first!, { key: "ArrowRight" });
    expect(buttons(container)[1]!.getAttribute("tabindex")).toBe("0");
    expect(buttons(container)[0]!.getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(buttons(container)[1]!, { key: "Home" });
    expect(buttons(container)[0]!.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(buttons(container)[0]!, { key: "End" });
    expect(buttons(container)[1]!.getAttribute("tabindex")).toBe("0");
  });

  it("selects the fitting on Enter or Space, and shows its selected ring with a warning glyph", () => {
    const store = createSelectionStore();
    const { container } = draw({ warns: (id) => id === "a" }, store);
    fireEvent.keyDown(buttons(container)[0]!, { key: "Enter" });
    expect(buttons(container)[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-testid='fitting-selected-ring']")).not.toBeNull();
    expect(container.querySelector("[data-testid='selection-warning']")).not.toBeNull();
  });

  it("shows a dotted ring on fittings linked from a focused form", () => {
    const store = createSelectionStore();
    const { container } = draw({}, store);
    act(() => store.setLinked([{ kind: "fitting", instanceId: "b" }]));
    const ring = container.querySelector("[data-testid='fitting-linked-ring']")!;
    expect(ring).not.toBeNull();
    expect(ring.closest("[data-target]")!.getAttribute("data-target")).toBe("b");
  });

  it("steps aside while a plan tool is active, leaving the click layer the clicks", () => {
    const { container } = draw({ disabled: true });
    const toolbar = container.querySelector("[role='toolbar']")!;
    expect(toolbar.getAttribute("aria-disabled")).toBe("true");
    expect(toolbar.getAttribute("class")).toContain("pointer-events-none");
    for (const g of buttons(container)) {
      expect(g.getAttribute("tabindex")).toBe("-1");
      expect(g.getAttribute("aria-disabled")).toBe("true");
    }
  });
});
