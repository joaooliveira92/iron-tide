import { describe, expect, it } from "vite-plus/test";
import { resolveMast, resolveMount, type MountQuery } from "../src/index.js";
import { catalog, mast, mount } from "./fixtures.js";

const query: MountQuery = {
  style: "B",
  era: "VICTORIAN",
  size: "LARGE",
  mountClass: "TURRET",
  guns: 2,
};

const universalDefault = mount("x-d-large-turret", {
  style: "X",
  era: "DREADNOUGHT",
  sizes: ["LARGE"],
  mountClass: "TURRET",
});

describe("resolveMount fallback chain (ADR-0148 §4)", () => {
  it("step 1: the exact style and era", () => {
    const c = catalog([
      universalDefault,
      mount("b-v", { style: "B", era: "VICTORIAN", sizes: ["LARGE"], mountClass: "TURRET" }),
    ]);
    expect(resolveMount(c, query)).toMatchObject({ part: { id: "b-v" }, step: 1 });
  });

  it("step 2: the universal style in the same era", () => {
    const c = catalog([
      universalDefault,
      mount("x-v", { style: "X", era: "VICTORIAN", sizes: ["LARGE"], mountClass: "TURRET" }),
    ]);
    expect(resolveMount(c, query)).toMatchObject({ part: { id: "x-v" }, step: 2 });
  });

  it("step 3: the nation's dreadnought-era drawing before the universal one", () => {
    const c = catalog([
      universalDefault,
      mount("b-d", { style: "B", era: "DREADNOUGHT", sizes: ["LARGE"], mountClass: "TURRET" }),
    ]);
    expect(resolveMount(c, query)).toMatchObject({ part: { id: "b-d" }, step: 3 });
  });

  it("step 4: the universal dreadnought default", () => {
    expect(resolveMount(catalog([universalDefault]), query)).toMatchObject({
      part: { id: "x-d-large-turret" },
      step: 4,
    });
  });

  it("prefers an exact gun count over a count-agnostic entry at the same step", () => {
    const c = catalog([
      mount("x-v-any", { style: "X", era: "VICTORIAN", sizes: ["LARGE"], mountClass: "TURRET" }),
      mount("x-v-2", {
        style: "X",
        era: "VICTORIAN",
        sizes: ["LARGE"],
        mountClass: "TURRET",
        guns: 2,
      }),
    ]);
    expect(resolveMount(c, query)?.part.id).toBe("x-v-2");
    expect(resolveMount(c, { ...query, guns: 1 })?.part.id).toBe("x-v-any");
  });

  it("an exact gun count never outranks an earlier step", () => {
    const c = catalog([
      mount("b-v-any", { style: "B", era: "VICTORIAN", sizes: ["LARGE"], mountClass: "TURRET" }),
      mount("x-v-2", {
        style: "X",
        era: "VICTORIAN",
        sizes: ["LARGE"],
        mountClass: "TURRET",
        guns: 2,
      }),
    ]);
    expect(resolveMount(c, query)?.part.id).toBe("b-v-any");
  });

  it("never matches across size or mount class", () => {
    const c = catalog([
      mount("x-d-medium", {
        style: "X",
        era: "DREADNOUGHT",
        sizes: ["MEDIUM"],
        mountClass: "TURRET",
      }),
      mount("x-d-barbette", {
        style: "X",
        era: "DREADNOUGHT",
        sizes: ["LARGE"],
        mountClass: "BARBETTE",
      }),
    ]);
    expect(resolveMount(c, query)).toBeNull();
  });

  it("one entry serves every size band it lists", () => {
    const c = catalog([
      mount("x-v-mid-small", {
        style: "X",
        era: "VICTORIAN",
        sizes: ["MEDIUM", "SMALL"],
        mountClass: "OPEN",
      }),
    ]);
    const open = { ...query, mountClass: "OPEN" } as const;
    expect(resolveMount(c, { ...open, size: "SMALL" })?.part.id).toBe("x-v-mid-small");
    expect(resolveMount(c, { ...open, size: "MEDIUM" })?.part.id).toBe("x-v-mid-small");
    expect(resolveMount(c, { ...open, size: "LARGE" })).toBeNull();
  });

  it("a gun-count entry for another count does not match", () => {
    const c = catalog([
      mount("x-d-3", {
        style: "X",
        era: "DREADNOUGHT",
        sizes: ["LARGE"],
        mountClass: "TURRET",
        guns: 3,
      }),
    ]);
    expect(resolveMount(c, query)).toBeNull();
  });
});

describe("resolveMast", () => {
  it("follows the same style/era chain", () => {
    const c = catalog([], [mast("x-d", "X", "DREADNOUGHT"), mast("x-v", "X", "VICTORIAN")]);
    expect(resolveMast(c, "B", "VICTORIAN")).toMatchObject({ part: { id: "x-v" }, step: 2 });
    expect(resolveMast(c, "B", "LATE_DREADNOUGHT")).toMatchObject({
      part: { id: "x-d" },
      step: 4,
    });
    expect(resolveMast(catalog([]), "X", "DREADNOUGHT")).toBeNull();
  });
});
