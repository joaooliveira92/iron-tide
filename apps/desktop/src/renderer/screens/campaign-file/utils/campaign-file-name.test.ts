import { describe, expect, it } from "vite-plus/test";

import { campaignFileName } from "./campaign-file-name.js";

describe("campaignFileName", () => {
  it("handles POSIX, Windows and trailing separators", () => {
    expect(campaignFileName("/a/b/save-1")).toBe("save-1");
    expect(campaignFileName("C:\\a\\b\\save-2")).toBe("save-2");
    expect(campaignFileName("/a/b/save-3/")).toBe("save-3");
  });
});
