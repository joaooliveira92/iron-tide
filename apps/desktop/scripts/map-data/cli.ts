import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { MapDataError } from "./errors.ts";
import { TilePack, encodeTilePack } from "../../src/renderer/components/globe-spike/tilepack.ts";
import {
  MANIFEST_FILE,
  PACK_FILE,
  buildAll,
  directoryBytes,
  listFiles,
  loadGeometry,
  loadInputs,
  verifyOutput,
  writeFiles,
} from "./pipeline.ts";
import { fetchSources, sha256Hex } from "./sources.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, "..", "..");
const REPO = resolve(DESKTOP, "..", "..");
const DEFAULT_CACHE = join(DESKTOP, ".map-data-cache");
const DEFAULT_OUT = join(DESKTOP, "map-spike-assets", "land-tiles");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    cache: { type: "string", default: DEFAULT_CACHE },
    out: { type: "string", default: DEFAULT_OUT },
    "write-expected": { type: "boolean", default: false },
    "no-pinning": { type: "boolean", default: false },
    "map-data": { type: "string" },
    "simplification-pixels": { type: "string" },
  },
});

const MAP_DATA = resolve(values["map-data"] ?? join(DESKTOP, "map-data"));
const command = positionals[0] ?? "help";
const cache = resolve(values.cache ?? DEFAULT_CACHE);
const out = resolve(values.out ?? DEFAULT_OUT);

async function bakeInto(
  target: string,
): Promise<{ ok: boolean; manifest: Record<string, unknown> }> {
  const loaded = await loadInputs(MAP_DATA);
  const override = values["simplification-pixels"];
  const inputs =
    override === undefined
      ? loaded
      : { ...loaded, config: { ...loaded.config, simplificationPixels: Number(override) } };
  const { geometry, layers } = await loadGeometry(inputs, cache);
  const built = await buildAll(inputs, geometry, layers, REPO, { pinning: !values["no-pinning"] });
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await writeFiles(target, built.files);
  for (const finding of built.report.findings) {
    console.error(
      `FAIL ${finding.featureId} z${finding.level ?? "-"} ${finding.rule}: ${finding.detail}`,
    );
  }
  return { ok: built.report.passed, manifest: built.manifest };
}

async function main(): Promise<number> {
  if (command === "fetch") {
    const inputs = await loadInputs(MAP_DATA);
    await fetchSources(inputs.pins, cache);
    console.log(`fetched and verified ${inputs.pins.sources.length} archives into ${cache}`);
    return 0;
  }
  if (command === "bake") {
    const started = Date.now();
    const result = await bakeInto(out);
    const sizes = result.manifest.sizes as Record<string, number>;
    console.log(
      `baked ${PACK_FILE}: ${sizes.packBytes} bytes, validation ${result.ok ? "passed" : "FAILED"} in ${Date.now() - started} ms`,
    );
    if (values["write-expected"]) {
      const integrity = result.manifest.integrity as { packSha256: string };
      const expected = {
        schemaVersion: 1,
        configurationSha256: result.manifest.configurationSha256,
        packSha256: integrity.packSha256,
        packBytes: sizes.packBytes,
        levels: (
          result.manifest.levels as { zoom: number; tiles: number; bytes: number; sha256: string }[]
        ).map(({ zoom, tiles, bytes, sha256 }) => ({ zoom, tiles, bytes, sha256 })),
        note: "Regenerate with: pnpm --filter @bluewave/desktop map-data bake --write-expected. Valid for the toolchain versions recorded in the generated manifest.",
      };
      await writeFile(
        join(MAP_DATA, "expected-output.v1.json"),
        `${JSON.stringify(expected, null, 2)}\n`,
      );
    }
    return result.ok ? 0 : 1;
  }
  if (command === "fixtures") {
    const bytes = new Uint8Array(await readFile(join(out, PACK_FILE)));
    const pack = TilePack.parse(bytes);
    const tiles = [...pack.entries()]
      .filter((entry) => entry.z <= 3)
      .map((entry) => ({ z: entry.z, x: entry.x, y: entry.y, data: pack.read(entry).slice() }));
    const small = encodeTilePack(tiles);
    const manifest = JSON.parse(await readFile(join(out, MANIFEST_FILE), "utf8")) as {
      sizes: { packBytes: number };
      integrity: { packSha256: string };
    };
    manifest.integrity.packSha256 = sha256Hex(small);
    manifest.sizes.packBytes = small.length;
    const corrupt = small.slice();
    corrupt[corrupt.length - 3] = (corrupt[corrupt.length - 3] ?? 0) ^ 0xa5;
    const target = `${out}-corrupt`;
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(target, PACK_FILE), corrupt);
    await writeFile(join(target, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`fixture: ${target} (${corrupt.length} bytes, one byte flipped after hashing)`);
    return 0;
  }
  if (command === "verify") {
    const inputs = await loadInputs(MAP_DATA);
    const result = await verifyOutput(out, inputs);
    for (const problem of result.problems) console.error(`FAIL ${problem}`);
    const manifest = JSON.parse(await readFile(join(out, MANIFEST_FILE), "utf8")) as {
      integrity: { packSha256: string };
    };
    try {
      const expected = JSON.parse(
        await readFile(join(MAP_DATA, "expected-output.v1.json"), "utf8"),
      ) as { packSha256: string };
      if (expected.packSha256 !== manifest.integrity.packSha256) {
        console.error(
          `FAIL pack hash ${manifest.integrity.packSha256} differs from the committed expectation ${expected.packSha256}`,
        );
        return 1;
      }
    } catch {
      console.error("FAIL map-data/expected-output.v1.json is missing");
      return 1;
    }
    console.log(result.ok ? "verify: ok" : "verify: FAILED");
    return result.ok ? 0 : 1;
  }
  if (command === "determinism") {
    const base = join(tmpdir(), `bluewave-map-data-${process.pid}`);
    const first = join(base, "run-1");
    const second = join(base, "run-2");
    const one = await bakeInto(first);
    const two = await bakeInto(second);
    const names = await listFiles(first);
    const namesTwo = await listFiles(second);
    const identical =
      JSON.stringify(names) === JSON.stringify(namesTwo) &&
      (
        await Promise.all(
          names.map(
            async (name) =>
              sha256Hex(new Uint8Array(await readFile(join(first, name)))) ===
              sha256Hex(new Uint8Array(await readFile(join(second, name)))),
          ),
        )
      ).every(Boolean);
    console.log(
      `determinism: ${identical ? "byte-identical" : "DIFFERENT"} across two clean runs (${names.length} files, ${await directoryBytes(first)} bytes)`,
    );
    console.log(`pack sha256 ${(one.manifest.integrity as { packSha256: string }).packSha256}`);
    await rm(base, { recursive: true, force: true });
    void two;
    void cp;
    return identical ? 0 : 1;
  }
  console.log(
    "usage: node scripts/map-data/cli.ts <fetch|bake|verify|determinism|fixtures> [--cache dir] [--out dir] [--write-expected]",
  );
  return command === "help" ? 0 : 2;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof MapDataError ? `${error._tag}: ${error.message}` : error);
    process.exitCode = 1;
  },
);
