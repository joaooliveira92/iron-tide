import type { DesignDraft, RebuildBalance } from "@bluewave/ship-design";
import { useBridge } from "../../../../lib/bridge-context.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import { Alert } from "../../../ui/alert.js";
import { ConfirmAction } from "../../ConfirmAction.js";
import { NumberField, SelectField } from "../../fields.js";
import { limitRows } from "../../rebuildView.js";
import { BulgeProjection } from "./BulgeProjection.js";
import { RebuildActionSelect } from "./RebuildActionSelect.js";
import { RebuildCheckReport } from "./RebuildCheckReport.js";
import { RebuildDesignProblems } from "./RebuildDesignProblems.js";
import { RebuildFindings } from "./RebuildFindings.js";
import { RebuildLimitsTable } from "./RebuildLimitsTable.js";
import { RebuildNote } from "./RebuildNote.js";
import { RebuildShell } from "./RebuildShell.js";
import { RebuildShipCard } from "./RebuildShipCard.js";
import { useRebuildState } from "./useRebuildState.js";

export interface RebuildHost {
  readonly confirmStart: boolean;
  readonly hideTitle: boolean;
  readonly loadHint: string;
}

export const DESIGN_WORKSPACE_REBUILD_HOST: RebuildHost = {
  confirmStart: true,
  hideTitle: false,
  loadHint: "Load the ship's design, change it on the board, and the rebuild check appears here.",
};

export function RebuildPanelBody({
  sessionId,
  draft,
  rules,
  onLoad,
  dirty,
  host,
}: {
  readonly sessionId: string | undefined;
  readonly draft: DesignDraft | null;
  readonly rules: RebuildBalance | null;
  readonly onLoad: (loaded: Record<string, unknown>) => void;
  readonly dirty: boolean;
  readonly host: RebuildHost;
}) {
  const bridge = useBridge();
  const format = usePresentationFormat();
  const { state, actions } = useRebuildState({
    bridge,
    sessionId,
    draft,
    onLoad,
  });
  const {
    ships,
    ship,
    action,
    blisterMassKg,
    bulgeMassKg,
    check,
    result,
    busy,
    isLoaded,
    canStart,
  } = state;
  const shell = { hideTitle: host.hideTitle };

  if (rules === null) {
    return (
      <RebuildShell {...shell}>
        <RebuildNote>This ruleset has no rebuild rules.</RebuildNote>
      </RebuildShell>
    );
  }
  if (sessionId === undefined || !bridge) {
    return (
      <RebuildShell {...shell}>
        <RebuildNote>Open a campaign to rebuild one of its ships.</RebuildNote>
      </RebuildShell>
    );
  }
  if (ship === undefined) {
    return (
      <RebuildShell {...shell}>
        <RebuildNote>
          None of your ships can be rebuilt yet. A ship can be rebuilt once it is built from one of
          your own designs, is not being built or rebuilt, and is not in a battle.
        </RebuildNote>
      </RebuildShell>
    );
  }

  const startDescription = `${ship.name} will be unavailable from the next month until the rebuild is finished: it cannot sail, train or fight. The old design stays on record. It is queued now and starts when the month is committed.`;

  return (
    <RebuildShell {...shell}>
      <SelectField
        label="Ship to rebuild"
        value={ship.shipId}
        options={ships.map((s) => ({ value: s.shipId, label: `${s.name} (${s.className})` }))}
        onChange={actions.choose}
      />
      <RebuildShipCard ship={ship} state={isLoaded ? "done" : "idle"} />
      <RebuildActionSelect value={action} onChange={actions.chooseAction} />
      <ConfirmAction
        variant="outline"
        confirm={dirty}
        title="Replace your design?"
        description="Loading this ship's design replaces the design you are working on, and its edit history is cleared."
        confirmLabel="Replace my design"
        onConfirm={() => void actions.load()}
      >
        Load this ship&apos;s design to rebuild it
      </ConfirmAction>

      {isLoaded && action === "BULGE" && (
        <NumberField
          label="Blister mass"
          unit="kg"
          value={blisterMassKg}
          min={0}
          step={1000}
          onCommit={actions.setBlisterMassKg}
          className="max-w-48"
        />
      )}

      {!isLoaded ? (
        <RebuildNote>{host.loadHint}</RebuildNote>
      ) : check === null ? (
        <RebuildNote>Checking…</RebuildNote>
      ) : (
        <RebuildCheckReport check={check}>
          {action === "BULGE" && (
            <BulgeProjection check={check} massKg={bulgeMassKg} format={format} />
          )}
          {check.measures !== null && (
            <RebuildLimitsTable rows={limitRows(check.measures, rules, format)} />
          )}
          {check.designProblems.length > 0 && (
            <RebuildDesignProblems problems={check.designProblems} />
          )}
          <RebuildFindings findings={check.findings} />
        </RebuildCheckReport>
      )}
      {!host.confirmStart && <RebuildNote>{startDescription}</RebuildNote>}
      <ConfirmAction
        confirm={host.confirmStart}
        disabled={!canStart}
        title={`Start rebuilding ${ship.name}?`}
        description={startDescription}
        confirmLabel="Queue the rebuild"
        onConfirm={() => void actions.start()}
      >
        {busy ? "Queuing…" : "Start the rebuild"}
      </ConfirmAction>
      {result !== null && (
        <Alert variant={result.tone === "ok" ? "default" : "destructive"}>{result.text}</Alert>
      )}
      <p className="text-xs text-muted-foreground">
        A rebuild keeps the hull: it may add up to a fifth in displacement and three knots, and
        change the length and beam by a twentieth. The hull form cannot change. The work is the new
        design&apos;s fittings; the hull and launch are kept.
      </p>
    </RebuildShell>
  );
}
