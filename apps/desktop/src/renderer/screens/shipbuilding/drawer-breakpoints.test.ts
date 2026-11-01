import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const rendererDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DRAWER_DIRECTORIES: readonly string[] = [
  "screens/shipbuilding/components",
  "components/design-workspace/panels",
];

const OUTSIDE_THE_DRAWER: ReadonlySet<string> = new Set([
  "screens/shipbuilding/components/ReferenceDeckCard.tsx",
  "screens/shipbuilding/components/ReferenceDeckDetail.tsx",
  "screens/shipbuilding/components/ReferenceDesignBrowser.tsx",
  "screens/shipbuilding/components/CommandBar.tsx",
  "screens/shipbuilding/components/ViewToolbar.tsx",
  "screens/shipbuilding/components/WorkspaceDialog.tsx",
  "screens/shipbuilding/components/Inspector.tsx",
  "components/design-workspace/panels/ShipTypeDetails.tsx",
]);

const VIEWPORT_BREAKPOINT = /(?<![\w@-])(?:max-)?(?:sm|md|lg|xl|2xl):/u;

function drawerSources(): readonly string[] {
  return DRAWER_DIRECTORIES.flatMap((directory) =>
    readdirSync(join(rendererDir, directory))
      .map((name) => `${directory}/${name}`)
      .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
      .filter((file) => !OUTSIDE_THE_DRAWER.has(file)),
  );
}

describe("drawer-hosted panels", () => {
  it("scans the panels and editors that render inside the design drawer", () => {
    const files = drawerSources();
    expect(files).toContain("screens/shipbuilding/components/MachineryEditor.tsx");
    expect(files).toContain("components/design-workspace/panels/BriefPanel.tsx");
    expect(files).not.toContain("screens/shipbuilding/components/ReferenceDeckDetail.tsx");
  });

  it("size to the drawer with container queries, never to the viewport", () => {
    const offenders = drawerSources().filter((file) =>
      VIEWPORT_BREAKPOINT.test(readFileSync(join(rendererDir, file), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("recognises viewport breakpoints and leaves container queries alone", () => {
    for (const viewport of ["md:grid-cols-2", "sm:flex-row", "max-md:hidden", "x 2xl:p-4"])
      expect(VIEWPORT_BREAKPOINT.test(viewport)).toBe(true);
    for (const container of [
      "@xl:grid-cols-3",
      "@max-xl:grid",
      "hover:bg-muted",
      "focus-visible:ring",
    ])
      expect(VIEWPORT_BREAKPOINT.test(container)).toBe(false);
  });
});
