import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function toPosix(path) {
  return path.split("\\").join("/");
}

export function discoverWorkspaces(root) {
  const workspaces = [];
  for (const group of ["packages", "apps"]) {
    const base = resolve(root, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = `${group}/${entry.name}`;
      const manifestPath = resolve(root, dir, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = readJson(manifestPath);
      workspaces.push({
        dir,
        name: manifest.name,
        kind: group === "apps" ? "app" : "package",
        scripts: manifest.scripts ?? {},
        dependencies: Object.keys(manifest.dependencies ?? {}),
        exports: manifest.exports ?? null,
      });
    }
  }
  if (existsSync(resolve(root, "content"))) {
    workspaces.push({
      dir: "content",
      name: "content",
      kind: "content",
      scripts: {},
      dependencies: [],
      exports: null,
    });
  }
  return workspaces.sort((a, b) => a.dir.localeCompare(b.dir));
}

export function workspaceForPath(path, workspaces) {
  const normalized = toPosix(path).replace(/^\.\//u, "");
  let match = null;
  for (const workspace of workspaces) {
    if (normalized === workspace.dir || normalized.startsWith(`${workspace.dir}/`)) {
      if (match === null || workspace.dir.length > match.dir.length) match = workspace;
    }
  }
  return match;
}

export function dependencyGraph(workspaces) {
  const names = new Set(workspaces.map((workspace) => workspace.name));
  const dependents = new Map();
  for (const workspace of workspaces) dependents.set(workspace.name, new Set());
  for (const workspace of workspaces) {
    for (const dependency of workspace.dependencies) {
      if (!names.has(dependency)) continue;
      dependents.get(dependency).add(workspace.name);
    }
  }
  return dependents;
}

export function expandDependents(names, workspaces) {
  const dependents = dependencyGraph(workspaces);
  const reached = new Set(names);
  const queue = [...names];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const dependent of dependents.get(current) ?? []) {
      if (reached.has(dependent)) continue;
      reached.add(dependent);
      queue.push(dependent);
    }
  }
  return [...reached].sort((a, b) => a.localeCompare(b));
}
