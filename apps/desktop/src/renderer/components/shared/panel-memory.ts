const KEY_PREFIX = "bluewave-panel:";

/**
 * Whether a collapsible panel is open, remembered for the session (window lifetime) so a panel the
 * player collapsed stays collapsed when they leave the screen and come back. Falls back to the
 * supplied default until the player chooses, and when storage is unavailable.
 */
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
  } catch {
    // Storage unavailable: the choice still applies until the panel unmounts.
  }
}
