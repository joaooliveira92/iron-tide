import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { AlertDialog, AlertDialogContent } from "./alert-dialog.js";
import { Dialog, DialogContent, DialogTitle } from "./dialog.js";
import { MODAL_SIZE_CLASS } from "./modal-frame.js";

afterEach(cleanup);

const RENDERER_ROOT = resolve(process.cwd(), "src/renderer");
const FRAME_OWNERS = ["components/ui/"];
const NON_MODAL_DIALOGS = [
  "components/slate/DepartmentDrawer.tsx",
  "shell/GuidedInspectionOverlay.tsx",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

function classesOf(element: HTMLElement): readonly string[] {
  return element.className.split(/\s+/);
}

describe("modal frame", () => {
  it("gives a Dialog and an AlertDialog of the same size the same frame", () => {
    render(
      <>
        <Dialog open>
          <DialogContent data-testid="dialog">
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
        <AlertDialog open>
          <AlertDialogContent size="standard" data-testid="alert">
            <DialogTitle>Alert</DialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </>,
    );
    for (const token of MODAL_SIZE_CLASS.standard.split(" ")) {
      expect(classesOf(screen.getByTestId("dialog"))).toContain(token);
      expect(classesOf(screen.getByTestId("alert"))).toContain(token);
    }
  });

  it("sizes confirmations narrower than a standard modal and lets height follow content", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="confirm">
          <DialogTitle>Confirm</DialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const classes = classesOf(screen.getByTestId("confirm"));
    expect(classes).toContain("w-[min(92vw,32rem)]");
    expect(classes).not.toContain("h-[85vh]");
  });

  it("keeps the reference modal size as the standard size", () => {
    expect(MODAL_SIZE_CLASS.standard).toBe("h-[85vh] max-h-[85vh] w-[min(92vw,80rem)]");
  });
});

describe("modal guard", () => {
  it("builds no modal outside the shared frame", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(RENDERER_ROOT)) {
      const rel = relative(RENDERER_ROOT, file).replaceAll("\\", "/");
      if (FRAME_OWNERS.some((prefix) => rel.startsWith(prefix))) continue;
      if (NON_MODAL_DIALOGS.includes(rel)) continue;
      const source = readFileSync(file, "utf8");
      if (/role="(?:alert)?dialog"/.test(source)) offenders.push(`${rel}: hand-rolled dialog role`);
      if (/aria-modal="true"/.test(source)) offenders.push(`${rel}: hand-rolled aria-modal`);
      if (/<(?:Alert)?DialogContent[^>]*\bclassName=/.test(source))
        offenders.push(`${rel}: sizes a dialog through className`);
    }
    expect(offenders).toEqual([]);
  });

  it("actually scans files (guards against a silently empty scan)", () => {
    expect(sourceFiles(RENDERER_ROOT).length).toBeGreaterThan(50);
  });
});
