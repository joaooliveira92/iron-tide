import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

export function packageDirectoryOf(executable) {
  const absolute = resolve(executable);
  const marker = absolute.indexOf(".app/");
  return marker >= 0 ? absolute.slice(0, marker + 4) : dirname(absolute);
}

export function runPackageGuard(mode, executable) {
  const result = spawnSync(
    process.execPath,
    [
      resolve(import.meta.dirname, "cli.ts"),
      "--mode",
      mode,
      "--package",
      packageDirectoryOf(executable),
    ],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, output };
}
