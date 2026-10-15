export const ACCENT_STYLES = {
  gold: {
    text: "text-admiralty-accent",
    border: "border-admiralty-accent/45",
    bg: "bg-admiralty-accent/10",
  },
  red: {
    text: "text-destructive",
    border: "border-destructive/40",
    bg: "bg-destructive/10",
  },
  blue: {
    text: "text-admiralty-signal",
    border: "border-admiralty-signal/40",
    bg: "bg-admiralty-signal/10",
  },
} as const;

/** Rest before a dossier section card opens, so sweeping the pointer across the tabs opens nothing (ms). */
export const DOSSIER_OPEN_DELAY = 140;
/** Grace before a card closes, long enough to move the pointer from a tab into its card (ms). */
export const DOSSIER_CLOSE_DELAY = 220;
