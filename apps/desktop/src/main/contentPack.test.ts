import { join } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";
import { resolveGeneratedContentDir } from "./contentPack.js";

const proc = process as { defaultApp?: boolean; resourcesPath?: string };
const originalDefaultApp = proc.defaultApp;
const originalResourcesPath = proc.resourcesPath;

afterEach(() => {
  if (originalDefaultApp === undefined) {
    delete proc.defaultApp;
  } else {
    proc.defaultApp = originalDefaultApp;
  }
  if (originalResourcesPath === undefined) {
    delete proc.resourcesPath;
  } else {
    proc.resourcesPath = originalResourcesPath;
  }
});

describe("content path resolution", () => {
  it("resolves relative to the repo root under plain node (tests, build scripts)", () => {
    delete proc.defaultApp;
    delete proc.resourcesPath;

    expect(resolveGeneratedContentDir()).toMatch(/content[/\\]generated[/\\]1880$/);
  });

  it("resolves from application resources in a packaged build", () => {
    delete proc.defaultApp;
    proc.resourcesPath = "/Applications/Bluewave.app/Contents/Resources";

    expect(resolveGeneratedContentDir()).toBe(
      join("/Applications/Bluewave.app/Contents/Resources", "content", "generated", "1880"),
    );
  });

  it("stays repo-relative in dev (defaultApp) even though Electron sets resourcesPath", () => {
    proc.defaultApp = true;
    proc.resourcesPath = "/some/electron/dist/Resources";

    expect(resolveGeneratedContentDir()).not.toContain("some/electron");
    expect(resolveGeneratedContentDir()).toMatch(/content[/\\]generated[/\\]1880$/);
  });
});
