/**
 * Builds the compiled content artifact (`content/generated/1880`) that the main
 * process runs on (ADR-0122, ticket 03). Uses the shared `@bluewave/content-compiler`
 * pipeline — the same one `bwc content:build` uses — so the artifact is produced
 * once, deterministically, and the app never parses raw content YAML.
 *
 * Runs before `electron-vite dev`/`build` (see package.json) and from the test
 * global setup, so a fresh checkout has the artifact without a manual step.
 */
import { resolve } from "node:path";

import {
  buildContentBundleArtifact,
  buildFullSurfaceInput,
  writeContentBundleArtifact,
} from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";

const repoRoot = resolve(import.meta.dirname, "../../..");
const contentDir = resolve(repoRoot, "content", "production", "1880");
const manifestPath = resolve(contentDir, "pack.json");
const outDir = resolve(repoRoot, "content", "generated", "1880");

const collector = new DiagnosticCollector();
const input = buildFullSurfaceInput(manifestPath, contentDir);
if (!input) {
  process.stderr.write(collector.toHuman() || "Content build failed to load the surface.\n");
  process.exit(1);
}
const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
if (!artifact) {
  process.stderr.write(collector.toHuman() || "Content build failed.\n");
  process.exit(1);
}

const { artifactPath } = writeContentBundleArtifact(outDir, artifact);
process.stdout.write(`content artifact: ${artifactPath}\n`);
