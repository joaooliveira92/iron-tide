import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, renameSync } from "node:fs";
import { resolve, normalize, isAbsolute, relative } from "node:path";
import { decodeStrict, PackManifestSchema } from "@bluewave/content-schema";
import { canonicalSerialize } from "@bluewave/deterministic";

export const PROJECT_FILE_EXT = ".bluewave";
export const PROJECT_FORMAT = "bluewave-project";
export const PROJECT_VERSION = 1;

export interface ProjectManifest {
  name?: string;
  version?: string;
  type?: string;
  files?: Record<string, readonly string[]>;
  [key: string]: unknown;
}

export interface BluewaveProject {
  format: string;
  version: number;
  name: string;
  manifest: ProjectManifest;
  files: Record<string, string>;
}

export class ProjectFormatError extends Error {
  readonly _tag = "ProjectFormatError";
  constructor(message: string) {
    super(message);
    this.name = "ProjectFormatError";
  }
}

export function loadContentDirectory(contentDir: string): BluewaveProject {
  const manifestPath = resolve(contentDir, "pack.json");
  if (!existsSync(manifestPath)) {
    throw new ProjectFormatError(`No pack.json found in ${contentDir}`);
  }
  let manifest: ProjectManifest;
  try {
    manifest = decodeStrict(PackManifestSchema, JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (err) {
    throw new ProjectFormatError(
      `Failed to parse ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const files: Record<string, string> = {};
  const referenced = manifest.files ?? {};
  const seen = new Set<string>();
  for (const category of Object.keys(referenced)) {
    for (const filename of referenced[category] ?? []) {
      safeRelative(filename);
      const key = filename.replace(/^[./]+/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      const fullPath = resolve(contentDir, filename);
      if (!existsSync(fullPath) || !isFileWithin(fullPath, contentDir)) {
        throw new Error(`Content file not found: ${filename}`);
      }
      files[key] = readFileSync(fullPath, "utf8");
    }
  }

  return buildProject(manifest, files);
}

export function buildProject(
  manifest: ProjectManifest,
  files: Record<string, string>,
): BluewaveProject {
  const name = typeof manifest.name === "string" ? manifest.name : "bluewave-project";
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name,
    manifest,
    files,
  };
}

export function serializeProject(project: BluewaveProject): string {
  return canonicalSerialize(project);
}

export function saveProjectFile(project: BluewaveProject, destPath: string): void {
  const json = serializeProject(project);
  const tmpPath = `${destPath}.tmp`;
  try {
    writeFileSync(tmpPath, json, "utf8");
    rmSync(destPath, { force: true });
    renameSync(tmpPath, destPath);
  } finally {
    rmSync(tmpPath, { force: true });
  }
}

export function loadProjectFile(filePath: string): BluewaveProject {
  if (!existsSync(filePath)) {
    throw new Error(`Project file not found: ${filePath}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new ProjectFormatError(`Failed to parse project file: ${filePath}`);
  }
  return validateProject(raw);
}

export function loadProjectFileJson(json: string): BluewaveProject {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ProjectFormatError("Failed to parse project JSON");
  }
  return validateProject(raw);
}

function validateProject(raw: unknown): BluewaveProject {
  const project = raw as Partial<BluewaveProject>;
  if (project.format !== PROJECT_FORMAT) {
    throw new ProjectFormatError(`Not a ${PROJECT_FORMAT} file`);
  }
  if (typeof project.version !== "number") {
    throw new ProjectFormatError("Project file is missing a version");
  }
  if (typeof project.name !== "string") {
    throw new ProjectFormatError("Project file is missing a name");
  }
  if (!project.manifest || typeof project.manifest !== "object") {
    throw new ProjectFormatError("Project file is missing a manifest");
  }
  if (!project.files || typeof project.files !== "object") {
    throw new ProjectFormatError("Project file is missing content files");
  }
  for (const filename of Object.keys(project.files)) {
    safeRelative(filename);
  }
  return project as BluewaveProject;
}

export function extractProject(project: BluewaveProject, destDir: string): void {
  if (existsSync(destDir)) {
    rmSync(destDir, { recursive: true, force: true });
  }
  mkdirSync(destDir, { recursive: true });
  writeFileSync(resolve(destDir, "pack.json"), canonicalSerialize(project.manifest), "utf8");
  for (const [filename, content] of Object.entries(project.files)) {
    safeRelative(filename);
    writeFileSync(resolve(destDir, filename), content, "utf8");
  }
}

function safeRelative(filename: string): void {
  const normalized = normalize(filename);
  const segments = normalized.split(/[/\\]+/);
  if (segments.includes("..") || isAbsolute(normalized)) {
    throw new Error(`Path traversal rejected for project file: ${filename}`);
  }
}

function isFileWithin(fullPath: string, contentDir: string): boolean {
  const rel = relative(contentDir, fullPath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}
