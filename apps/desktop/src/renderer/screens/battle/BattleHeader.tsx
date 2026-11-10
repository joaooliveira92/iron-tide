import { useBattleSession } from "./session/BattleSession.js";

export function BattleHeader({ onAbandon }: { readonly onAbandon: () => void }) {
  const {
    state: { view, resume, error },
    meta,
  } = useBattleSession();
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Battle of {meta.areaId}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {view === null
              ? "Projecting the committed battle…"
              : `${view.campaignMonth} · minute ${String(view.minute)} / ${String(view.maxMinutes)} · sea ${view.weather.seaState}`}
          </p>
          {resume === "resumed" && (
            <p data-testid="battle-resumed" className="mt-1 text-xs text-muted-foreground">
              Resumed from the saved battle at minute {view?.minute ?? 0}.
            </p>
          )}
        </div>
        <button
          type="button"
          data-testid="battle-abandon"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onAbandon}
        >
          Abandon turn
        </button>
      </div>

      {error !== null && (
        <p data-testid="battle-error" role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </>
  );
}
