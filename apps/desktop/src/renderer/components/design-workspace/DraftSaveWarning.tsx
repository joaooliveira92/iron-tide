export function DraftSaveWarning({
  visible,
  onDismiss,
}: {
  readonly visible: boolean;
  readonly onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="pointer-events-auto fixed bottom-4 left-1/2 z-[90] flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-background p-3 text-sm shadow-lg"
    >
      <span>
        The draft is not saved. Bluewave will keep retrying, and the latest edits are kept.
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
