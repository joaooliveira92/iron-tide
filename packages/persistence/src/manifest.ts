import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import { readSaveManifest } from "./fileDecode.js";
import type { SaveManifest } from "./schemas.js";

export const SAVE_MANIFEST_FILE = "manifest.json";
export const SAVE_FORMAT_VERSION = 1;
export const SAVE_HASH_VERSION = "sha256-hex/v1";
export const LEGACY_SIG_FILE = "campaign.sig.json";

export type SaveManifestCheck =
  | { readonly status: "current" }
  | { readonly status: "legacy" }
  | { readonly status: "invalid"; readonly message: string };

export function saveFileNames(savePath: string): string[] {
  return readdirSync(savePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== SAVE_MANIFEST_FILE)
    .map((entry) => entry.name)
    .sort(compareCodePoints);
}

export function buildSaveManifest(savePath: string): SaveManifest {
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    hashVersion: SAVE_HASH_VERSION,
    files: saveFileNames(savePath).map((name) => ({
      name,
      hash: sha256Hex(readFileSync(join(savePath, name), "utf8")),
    })),
  };
}

export function writeSaveManifest(savePath: string): SaveManifest {
  const manifest = buildSaveManifest(savePath);
  writeFileSync(
    join(savePath, SAVE_MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

export function integrityMessageForFile(name: string): string {
  if (name === "campaign.json") return "Saved campaign data failed its integrity check";
  if (name === "metadata.json") return "Saved campaign metadata failed its integrity check";
  if (name === "month-input.json") return "Saved month input failed its integrity check";
  return "A saved campaign file failed its integrity check";
}

export function verifySaveManifest(savePath: string): SaveManifestCheck {
  const manifestPath = join(savePath, SAVE_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return { status: "legacy" };

  const manifest = readSaveManifest(manifestPath);
  if (manifest === null)
    return { status: "invalid", message: "Save integrity manifest is invalid" };
  if (manifest.formatVersion !== SAVE_FORMAT_VERSION) {
    return { status: "invalid", message: "Save integrity manifest format is unsupported" };
  }
  if (manifest.hashVersion !== SAVE_HASH_VERSION) {
    return { status: "invalid", message: "Save integrity hash version is unsupported" };
  }

  const listed = new Map<string, string>();
  for (const file of manifest.files) {
    if (listed.has(file.name)) {
      return { status: "invalid", message: "Save integrity manifest repeats a file" };
    }
    listed.set(file.name, file.hash);
  }

  const actual = saveFileNames(savePath);
  for (const name of actual) {
    if (!listed.has(name)) {
      return {
        status: "invalid",
        message: "Save integrity manifest does not list every saved file",
      };
    }
  }
  for (const name of listed.keys()) {
    if (!actual.includes(name)) {
      return { status: "invalid", message: "A file listed in the save manifest is missing" };
    }
  }
  for (const [name, hash] of listed) {
    let content: string;
    try {
      content = readFileSync(join(savePath, name), "utf8");
    } catch {
      return { status: "invalid", message: integrityMessageForFile(name) };
    }
    if (sha256Hex(content) !== hash) {
      return { status: "invalid", message: integrityMessageForFile(name) };
    }
  }
  return { status: "current" };
}
