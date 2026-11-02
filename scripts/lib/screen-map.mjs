import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SCREENS_ROOT = "apps/desktop/src/renderer/screens";
export const SHELL_ROOT = "apps/desktop/src/renderer/shell";
export const E2E_ROOT = "apps/desktop/e2e";
const ENTRY_PATTERN = /(?:Screen|Workspace)\.tsx$/u;
const TEST_PATTERN = /\.test\.[cm]?[jt]sx?$/u;
const MAX_BUFFER = 32 * 1024 * 1024;

function trackedFiles(root, pathspec) {
  const output = execFileSync("git", ["-C", root, "ls-files", "--", pathspec], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
  return output.split("\n").filter(Boolean);
}

function lineCount(root, path) {
  try {
    const text = readFileSync(join(root, path), "utf8");
    return text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  } catch {
    return 0;
  }
}

function groupByScreen(files) {
  const screens = new Map();
  for (const file of files) {
    const rest = file.slice(SCREENS_ROOT.length + 1);
    const slash = rest.indexOf("/");
    const name = slash === -1 ? rest.replace(/\.[^.]+$/u, "") : rest.slice(0, slash);
    if (!screens.has(name)) screens.set(name, []);
    screens.get(name).push(file);
  }
  return screens;
}

function pickEntry(files) {
  return (
    files
      .filter((file) => ENTRY_PATTERN.test(file) && !TEST_PATTERN.test(file))
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0] ?? null
  );
}

export function listScreens(root) {
  const screens = groupByScreen(trackedFiles(root, SCREENS_ROOT));
  return [...screens.entries()]
    .map(([name, files]) => ({
      name,
      entry: pickEntry(files),
      files: files.length,
      tests: files.filter((file) => TEST_PATTERN.test(file)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function describeScreen(root, name, limit) {
  const screens = groupByScreen(trackedFiles(root, SCREENS_ROOT));
  const files = screens.get(name);
  if (files === undefined) return null;
  const entry = pickEntry(files);
  const sizes = files
    .filter((file) => !TEST_PATTERN.test(file))
    .map((file) => ({ path: file, lines: lineCount(root, file) }))
    .sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
  const e2e = trackedFiles(root, E2E_ROOT).filter((file) => file.includes(name));
  const component =
    entry === null ? null : entry.slice(entry.lastIndexOf("/") + 1).replace(/\.tsx$/u, "");
  let routes = [];
  if (component !== null) {
    try {
      routes = execFileSync("git", ["-C", root, "grep", "-l", "-w", component, "--", SHELL_ROOT], {
        encoding: "utf8",
      })
        .split("\n")
        .filter(Boolean);
    } catch {
      routes = [];
    }
  }
  return {
    name,
    entry,
    routes,
    largest: sizes.slice(0, limit),
    tests: files.filter((file) => TEST_PATTERN.test(file)).slice(0, limit),
    e2e: e2e.slice(0, limit),
    fileCount: files.length,
  };
}

export function renderScreenList(screens) {
  const rows = screens.map(
    (screen) =>
      `${screen.name.padEnd(22)} ${screen.entry ?? "-"} (${screen.files} files, ${screen.tests} tests)`,
  );
  return `${rows.join("\n")}\n`;
}

export function renderScreen(report) {
  const lines = [`screen: ${report.name}`, `entry: ${report.entry ?? "-"}`];
  lines.push(`routes: ${report.routes.length === 0 ? "-" : report.routes.join(", ")}`);
  lines.push(`files: ${report.fileCount}`);
  lines.push(
    "largest:",
    ...report.largest.map((item) => `  ${String(item.lines).padStart(5)}  ${item.path}`),
  );
  lines.push("tests:", ...report.tests.map((path) => `  ${path}`));
  lines.push("e2e:", ...report.e2e.map((path) => `  ${path}`));
  return `${lines.join("\n")}\n`;
}
