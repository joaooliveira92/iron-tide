import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { funnelPlacements } from "./funnelPlacements.js";
import { planModel } from "./planModel.js";
import { ProfileView } from "./ProfileView.js";
import { content, frame, hullForm as form, reference, view } from "./test-fixtures.js";

const model = planModel(reference.draft, content, view, reference.month);
const draw = (superstructure: typeof model.superstructure) =>
  render(
    <ProfileView
      draft={reference.draft}
      content={content}
      sheerBp={form.sheerBp}
      bow={frame.bow}
      stern={frame.stern}
      lcbPermille={frame.lcbPermille}
      superstructure={superstructure}
      facts={model.facts}
      mounts={model.visualMounts}
      look={model.look}
    />,
  );

describe("ProfileView", () => {
  it("is a described image of the side profile on the plan's scale", () => {
    const { getByRole } = draw(model.superstructure);
    const image = getByRole("img");
    const label = image.getAttribute("aria-label")!;
    expect(label.startsWith("Side profile")).toBe(true);
    expect(label).toMatch(/depth .* m, draught .* m/);
    expect(label).toMatch(/bow/);
    expect(label).toMatch(/schematic/);
    expect(image.getAttribute("data-testid")).toBe("hull-profile");
  });

  it("draws the hull and waterline, and one funnel per placed funnel component", () => {
    const { container } = draw(model.superstructure);
    expect(container.querySelector("[data-testid='profile-hull']")).not.toBeNull();
    expect(container.querySelector("[data-testid='profile-waterline']")).not.toBeNull();
    expect(container.querySelectorAll("[data-testid='profile-funnel']")).toHaveLength(
      funnelPlacements(reference.draft, content).length,
    );
  });

  it("omits the house masses when the hull form has no superstructure", () => {
    const { container } = draw(undefined);
    expect(container.querySelector("[data-testid='profile-superstructure']")).toBeNull();
  });

  it("draws every gun placement as a catalog mount symbol", () => {
    const { container } = draw(model.superstructure);
    const guns = reference.draft.placements
      .filter((p) => content.components.find((c) => c.id === p.componentId)?.tags.includes("gun"))
      .map((p) => p.instanceId)
      .sort((a, b) => a.localeCompare(b));
    const mounts = [...container.querySelectorAll("[data-testid='profile-mount']")];
    expect(
      mounts.map((m) => m.getAttribute("data-instance") ?? "").sort((a, b) => a.localeCompare(b)),
    ).toEqual(guns);
    for (const m of mounts) {
      expect(m.getAttribute("data-part")).toBe("x-victorian-open");
      expect(m.querySelector("title")?.textContent).toMatch(/Open mount, 1 × [23] in/);
    }
  });

  it("layers mounts in front of the superstructure and behind the waterline datum", () => {
    const { container } = draw(model.superstructure);
    const order = [
      "profile-hull",
      "profile-superstructure",
      "profile-mount",
      "profile-waterline",
    ].map((id) => container.querySelector(`[data-testid='${id}']`)!);
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("draws far-side (port) mounts muted", () => {
    const { container } = draw(model.superstructure);
    const port = container.querySelector("[data-instance='gun_6pdr_a']")!;
    const stbd = container.querySelector("[data-instance='gun_6pdr_b']")!;
    expect(port.getAttribute("data-far")).toBe("true");
    expect(stbd.getAttribute("data-far")).toBeNull();
  });

  it("restyles the same compiled mounts when the design month moves from 1890 to 1898 (AC-4)", () => {
    const partsIn = (month: string) => {
      const m = planModel(reference.draft, content, view, month);
      const { container } = render(
        <ProfileView
          draft={reference.draft}
          content={content}
          sheerBp={form.sheerBp}
          bow={frame.bow}
          stern={frame.stern}
          lcbPermille={frame.lcbPermille}
          superstructure={m.superstructure}
          facts={m.facts}
          mounts={m.visualMounts}
          look={m.look}
        />,
      );
      return [...container.querySelectorAll("[data-testid='profile-mount']")].map(
        (el) => `${el.getAttribute("data-instance")}=${el.getAttribute("data-part")}`,
      );
    };
    const victorian = partsIn("1890-01");
    const preDreadnought = partsIn("1898-01");
    expect(victorian).toContain("gun_12pdr=x-victorian-open");
    expect(preDreadnought).toContain("gun_12pdr=x-pre-dreadnought-open");
    expect(preDreadnought.map((s) => s.split("=")[0])).toEqual(
      victorian.map((s) => s.split("=")[0]),
    );
  });

  it("stands a foremast at the bridge and a mainmast at the superstructure's aft end, behind the hull", () => {
    const { container } = draw(model.superstructure);
    const masts = [...container.querySelectorAll("[data-testid='profile-mast']")];
    expect(masts).toHaveLength(2);
    const stations = masts.map((m) => Number(m.getAttribute("data-station")));
    const zone = model.superstructure!;
    expect(stations[0]).toBeGreaterThan(zone.startPermille);
    expect(stations[0]).toBeLessThan(zone.endPermille);
    expect(stations[1]).toBe(zone.endPermille);
    expect(masts.map((m) => m.getAttribute("data-part"))).toEqual([
      "x-victorian-mast",
      "x-victorian-mast",
    ]);
    const hull = container.querySelector("[data-testid='profile-hull']")!;
    expect(masts[1]!.compareDocumentPosition(hull) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no masts without a superstructure", () => {
    const { container } = draw(undefined);
    expect(container.querySelectorAll("[data-testid='profile-mast']")).toHaveLength(0);
  });
});
