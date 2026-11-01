import { describe, expect, it } from "vite-plus/test";
import { startsCollapsed } from "./status-strip-start.js";

describe("startsCollapsed", () => {
  it("gives the ship drawing the room on the design screen", () => {
    expect(startsCollapsed("ship-design")).toBe(true);
  });

  it("leaves every other screen expanded", () => {
    expect(startsCollapsed("overview")).toBe(false);
    expect(startsCollapsed("strategic-map")).toBe(false);
    expect(startsCollapsed("fleet")).toBe(false);
  });
});
