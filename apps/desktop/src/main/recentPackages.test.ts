import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  listRecentPackages,
  RECENT_PACKAGES_FILENAME,
  recordRecentPackage,
  isApprovedPackage,
} from "./recentPackages.js";

describe("recent-packages.json fallback", () => {
  let userData: string;
  let pkg: string;

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), "bw-recent-userdata-"));
    pkg = mkdtempSync(join(tmpdir(), "bw-recent-pkg-"));
    mkdirSync(pkg, { recursive: true });
  });
  afterEach(() => {
    rmSync(userData, { recursive: true, force: true });
    rmSync(pkg, { recursive: true, force: true });
  });

  const file = () => join(userData, RECENT_PACKAGES_FILENAME);
  const entry = () => ({
    path: pkg,
    campaignIdentity: "campaign-1",
    activeRevision: 2,
    lastOpened: 1,
  });

  it.each([
    ["unparseable JSON", "{ not json"],
    ["an empty file", ""],
    ["a non-object value", "[1, 2, 3]"],
    ["an unknown schema version", JSON.stringify({ version: 2, entries: [] })],
    ["an unmodeled top-level key", JSON.stringify({ version: 1, entries: [], extra: true })],
    [
      "an unmodeled key on an entry",
      JSON.stringify({
        version: 1,
        entries: [
          { path: "/p", campaignIdentity: "c", activeRevision: 1, lastOpened: 1, extra: true },
        ],
      }),
    ],
    ["entries of the wrong shape", JSON.stringify({ version: 1, entries: [{ path: 7 }] })],
  ])("treats %s as an empty list and approves nothing", (_label, contents) => {
    writeFileSync(file(), contents, "utf8");

    expect(listRecentPackages(userData)).toEqual([]);
    expect(isApprovedPackage(userData, pkg)).toBeNull();
  });

  it("treats a missing file as an empty list", () => {
    expect(listRecentPackages(userData)).toEqual([]);
  });

  it("recovers by overwriting a corrupt file on the next successful open", () => {
    writeFileSync(file(), "{ not json", "utf8");

    recordRecentPackage(userData, entry());

    const listed = listRecentPackages(userData);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.campaignIdentity).toBe("campaign-1");
    expect(() => JSON.parse(readFileSync(file(), "utf8"))).not.toThrow();
  });
});
