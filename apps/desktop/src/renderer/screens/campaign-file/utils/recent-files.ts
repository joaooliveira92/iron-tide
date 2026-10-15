import type { RecentFile } from "../types.js";

const RECENT_FILES_KEY = "bluewave-recent-files";
const MAX_RECENT = 5;
const RECENT_FILES_SCHEMA_VERSION = 1;

interface RecentFilesStorage {
  readonly version: typeof RECENT_FILES_SCHEMA_VERSION;
  readonly files: readonly RecentFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecentFile(value: unknown): value is RecentFile {
  if (!isRecord(value)) return false;
  return (
    typeof value.path === "string" &&
    typeof value.campaignIdentity === "string" &&
    typeof value.activeRevision === "number" &&
    typeof value.lastOpened === "number"
  );
}

function writeRecentFiles(files: readonly RecentFile[]): void {
  const stored: RecentFilesStorage = {
    version: RECENT_FILES_SCHEMA_VERSION,
    files: files.slice(0, MAX_RECENT),
  };
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(stored));
}

export function loadRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const legacyFiles = parsed.filter(isRecentFile);
      writeRecentFiles(legacyFiles);
      return legacyFiles;
    }

    if (!isRecord(parsed)) return [];
    if (parsed.version !== RECENT_FILES_SCHEMA_VERSION || !Array.isArray(parsed.files)) return [];
    return parsed.files.filter(isRecentFile);
  } catch {
    return [];
  }
}

export function saveRecentFile(entry: RecentFile): void {
  const existing = loadRecentFiles().filter((file) => file.path !== entry.path);
  writeRecentFiles([entry, ...existing]);
}

export function removeRecentFile(path: string): void {
  writeRecentFiles(loadRecentFiles().filter((file) => file.path !== path));
}

export function campaignFileName(path: string): string {
  return path.split("/").pop() ?? path;
}
