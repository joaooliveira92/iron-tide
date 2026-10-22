const KEY_PREFIX = "bluewave-panel:";

export function readPanelOpen(id: string, fallback: boolean): boolean {
  try {
    const stored = sessionStorage.getItem(KEY_PREFIX + id);
    return stored === "open" ? true : stored === "closed" ? false : fallback;
  } catch {
    return fallback;
  }
}

export function writePanelOpen(id: string, open: boolean): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + id, open ? "open" : "closed");
  } catch {}
}
