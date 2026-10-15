import { describe, it, expect } from "vite-plus/test";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

let hasElectron = false;
try {
  _require.resolve("electron");
  hasElectron = true;
} catch {
  hasElectron = false;
}

// Electron is only present in the packaged e2e job; locally the suite is skipped.
const describeIf = hasElectron ? describe : describe.skip; // test-focus-allow-skip: Electron optional outside e2e

describeIf("Desktop smoke test", () => {
  it("Electron resolves successfully", () => {
    const electronPath = _require.resolve("electron");
    expect(electronPath).toBeTruthy();
    expect(typeof electronPath).toBe("string");
  });
});
