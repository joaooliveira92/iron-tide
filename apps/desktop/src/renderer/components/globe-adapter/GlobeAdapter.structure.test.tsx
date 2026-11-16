import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GlobeAdapter } from "./GlobeAdapter.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import { fakeMap as fake } from "./fake-maplibre.js";

vi.mock("maplibre-gl", async () => {
  const { FakeMapClass } = await import("./fake-maplibre.js");
  return {
    Map: FakeMapClass,
    addProtocol: () => undefined,
    removeProtocol: () => undefined,
    setWorkerUrl: () => undefined,
  };
});

vi.mock("../globe-spike/use-land-plan.js", async () => {
  const { fakeManifest } = await import("./fake-maplibre.js");
  const tiles = {
    pack: {},
    manifest: fakeManifest,
    diagnostics: { requests: 0, served: 0, empty: 0, failures: [] },
  };
  const plan = { kind: "baked", tiles };
  return { useLandPlan: () => plan };
});

vi.mock("../globe-spike/map-container.js", async () => {
  const actual = await vi.importActual<typeof import("../globe-spike/map-container.js")>(
    "../globe-spike/map-container.js",
  );
  return { ...actual, hasRenderableSize: () => true };
});

const overlay = {
  ...EMPTY_LIVE_OVERLAY,
  source: "campaign" as const,
  ownership: new Map([["area_north_sea", "united_kingdom"]]),
};

function outline(root: Element): readonly string[] {
  const marks = root.querySelectorAll(
    '[data-testid], nav, table, button[aria-expanded], [role="application"], [role="tooltip"], [role="status"], svg[aria-label], [data-map-variant]',
  );
  return Array.from(marks, (element) => {
    const tag = element.tagName.toLowerCase();
    const testId = element.getAttribute("data-testid") ?? "";
    const role = element.getAttribute("role") ?? "";
    const label = (element.getAttribute("aria-label") ?? element.textContent ?? "").slice(0, 28);
    return `${tag}|${testId}|${role}|${label}`;
  });
}

async function mounted(variant: MapVariant, extra: { readonly showMinimap?: boolean }) {
  const view = render(
    <GlobeAdapter
      state={{ ...initialMapPrototypeState, projection: "equirectangular" }}
      route={null}
      overlay={overlay}
      onSelect={() => undefined}
      onRuler={() => undefined}
      onToggleLayer={() => undefined}
      onSetProjection={() => undefined}
      onSetCentre={() => undefined}
      onUnavailable={() => undefined}
      variant={variant}
      {...extra}
    />,
  );
  await waitFor(() => {
    expect(
      view.container
        .querySelector('[data-testid="globe-adapter"]')
        ?.getAttribute("data-globe-adapter-ready"),
    ).toBe("true");
  });
  return view;
}

function hasMinimap(root: Element): boolean {
  return Array.from(root.querySelectorAll("svg")).some((svg) =>
    (svg.getAttribute("aria-label") ?? "").toLowerCase().includes("minimap"),
  );
}

describe("GlobeAdapter rendered structure", () => {
  beforeEach(() => {
    fake.instance = null;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({ matches: false, media: "" }),
    });
  });
  afterEach(cleanup);

  it("reports a forced failure when the demo failure hash is active, without any prop", async () => {
    window.location.hash = "#globe-adapter-demo-fail";
    const onUnavailable = vi.fn();
    render(
      <GlobeAdapter
        state={{ ...initialMapPrototypeState, projection: "equirectangular" }}
        route={null}
        overlay={overlay}
        onSelect={() => undefined}
        onRuler={() => undefined}
        onToggleLayer={() => undefined}
        onSetProjection={() => undefined}
        onSetCentre={() => undefined}
        onUnavailable={onUnavailable}
      />,
    );
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledWith("forced adapter failure"));
    window.location.hash = "";
  });

  it("keeps the full variant order with the minimap", async () => {
    const view = await mounted("full", {});
    expect(hasMinimap(view.container)).toBe(true);
    expect(outline(view.container)).toMatchInlineSnapshot(`
      [
        "div|globe-adapter||idle z=1.60 source z1 tiles=",
        "div||application|Strategic world map, experim",
        "span|globe-adapter-status||idle z=1.60 source z1 tiles=",
        "button|||Layers & areas",
        "details|area-list||Areas (0)ShipsPossessionsNo ",
        "div|area-tree||ShipsPossessionsNo areas wit",
        "span|globe-adapter-frame-meter||drag or zoom to measure",
        "nav|globe-adapter-area-list||Map areas",
        "nav|globe-adapter-entities||Ports and fleets",
        "table|globe-adapter-area-table||Area controlAreaControlled b",
        "svg|globe-adapter-minimap|img|World minimap. Choose a poin",
        "div|globe-adapter-live|status|No route reading. Shift-clic",
        "table|||Globe adapter entitiesNameKi",
        "div|globe-adapter-camera||{"version":1,"centre":[10,30",
        "div|globe-adapter-hierarchy||{"version":1,"sourceMaxZoom"",
      ]
    `);
  });

  it("keeps the full variant order without the minimap", async () => {
    const view = await mounted("full", { showMinimap: false });
    expect(hasMinimap(view.container)).toBe(false);
    expect(outline(view.container)).toMatchInlineSnapshot(`
      [
        "div|globe-adapter||idle z=1.60 source z1 tiles=",
        "div||application|Strategic world map, experim",
        "span|globe-adapter-status||idle z=1.60 source z1 tiles=",
        "button|||Layers & areas",
        "details|area-list||Areas (0)ShipsPossessionsNo ",
        "div|area-tree||ShipsPossessionsNo areas wit",
        "span|globe-adapter-frame-meter||drag or zoom to measure",
        "nav|globe-adapter-area-list||Map areas",
        "nav|globe-adapter-entities||Ports and fleets",
        "table|globe-adapter-area-table||Area controlAreaControlled b",
        "div|globe-adapter-live|status|No route reading. Shift-clic",
        "table|||Globe adapter entitiesNameKi",
        "div|globe-adapter-camera||{"version":1,"centre":[10,30",
        "div|globe-adapter-hierarchy||{"version":1,"sourceMaxZoom"",
      ]
    `);
  });

  it("keeps the command variant order with the minimap", async () => {
    const view = await mounted("command", {});
    expect(hasMinimap(view.container)).toBe(true);
    expect(outline(view.container)).toMatchInlineSnapshot(`
      [
        "div|globe-adapter||idle z=1.60 source z1 tiles=",
        "div||application|Strategic world map, experim",
        "span|globe-adapter-status||idle z=1.60 source z1 tiles=",
        "button|||Layers & areas",
        "button|||Ports and fleets",
        "table|globe-adapter-area-table||Area controlAreaControlled b",
        "svg|globe-adapter-minimap|img|World minimap. Choose a poin",
        "div|globe-adapter-live|status|No route reading. Shift-clic",
        "table|||Globe adapter entitiesNameKi",
        "div|globe-adapter-camera||{"version":1,"centre":[10,30",
        "div|globe-adapter-hierarchy||{"version":1,"sourceMaxZoom"",
      ]
    `);
  });

  it("keeps the panel variant order without the minimap", async () => {
    const view = await mounted("panel", { showMinimap: false });
    expect(hasMinimap(view.container)).toBe(false);
    expect(outline(view.container)).toMatchInlineSnapshot(`
      [
        "div|globe-adapter||idle z=1.60 source z1 tiles=",
        "div||application|Strategic world map, experim",
        "span|globe-adapter-status||idle z=1.60 source z1 tiles=",
        "button|||Layers & areas",
        "details|area-list||Areas (0)ShipsPossessionsNo ",
        "div|area-tree||ShipsPossessionsNo areas wit",
        "span|globe-adapter-frame-meter||drag or zoom to measure",
        "nav|globe-adapter-area-list||Map areas",
        "nav|globe-adapter-entities||Ports and fleets",
        "table|globe-adapter-area-table||Area controlAreaControlled b",
        "div|globe-adapter-live|status|No route reading. Shift-clic",
        "table|||Globe adapter entitiesNameKi",
        "div|globe-adapter-camera||{"version":1,"centre":[10,30",
        "div|globe-adapter-hierarchy||{"version":1,"sourceMaxZoom"",
      ]
    `);
  });
});
