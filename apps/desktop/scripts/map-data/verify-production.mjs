import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TilePack } from "../../src/renderer/components/globe-spike/tilepack.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, "..", "..");
const ROOT = join(DESKTOP, "map-assets");
const TILES = join(ROOT, "land-tiles");
const HARNESS_ONLY = new Set(["protected-resolution.json", "validation.json"]);

const problems = [];
const note = (message) => problems.push(message);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => readFile(path);

const manifest = JSON.parse(await read(join(TILES, "manifest.json")).then(String));
const expected = JSON.parse(
  await read(join(DESKTOP, "map-data", "expected-output.v1.json")).then(String),
);
const packBytes = new Uint8Array(await read(join(TILES, "land.bwtp")));

const packSha = sha256(packBytes);
if (packSha !== expected.packSha256) {
  note(`pack sha256 ${packSha} differs from the committed expectation ${expected.packSha256}`);
}
if (manifest.integrity?.packSha256 !== packSha) {
  note("manifest integrity.packSha256 does not match land.bwtp");
}
if (manifest.sizes?.packBytes !== packBytes.length) {
  note(`manifest sizes.packBytes ${manifest.sizes?.packBytes} != ${packBytes.length}`);
}
if (manifest.zoom?.fitForPurposeMax !== 7 || manifest.zoom?.overscaleMax !== 12) {
  note(`unexpected zoom contract ${JSON.stringify(manifest.zoom)}`);
}

for (const [name, hash] of Object.entries(manifest.integrity?.files ?? {})) {
  if (HARNESS_ONLY.has(name)) continue;
  try {
    const actual = sha256(new Uint8Array(await read(join(TILES, name))));
    if (actual !== hash) note(`${name} sha256 does not match the manifest`);
  } catch {
    note(`${name} is listed in the manifest but missing`);
  }
}

const pack = TilePack.parse(packBytes);
let tiles = 0;
for (const entry of pack.entries()) {
  try {
    pack.read(entry);
    tiles += 1;
  } catch (error) {
    note(`tile ${entry.z}/${entry.x}/${entry.y} failed integrity: ${String(error)}`);
  }
}

for (const range of ["0-255", "256-511", "8192-8447"]) {
  const path = join(ROOT, "glyphs", "Inter Regular", `${range}.pbf`);
  try {
    const info = await stat(path);
    if (info.size === 0) note(`glyph range ${range} is empty`);
  } catch {
    note(`glyph range ${range} is missing`);
  }
}
try {
  const ofl = await read(join(ROOT, "glyphs", "OFL.txt"));
  if (ofl.length === 0) note("the Inter OFL notice is empty");
} catch {
  note("the Inter OFL notice is missing");
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `map-assets: ok (${tiles} tiles, ${packBytes.length} bytes, sha256 ${packSha}, z${manifest.zoom.fitForPurposeMax} source ceiling)`,
  );
}
