import { useEffect, useState } from "react";
import { envelopeOf, stampCommand } from "../../../lib/command-envelope.js";
import { kg, type DesignDraft } from "@bluewave/ship-design";
import { Ship } from "lucide-react";
import { useBridge } from "../../../lib/bridge-context.js";
import { Alert } from "../../ui/alert.js";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "../../ui/attachment.js";
import { Badge } from "../../ui/badge.js";
import type { RebuildableShipView, RebuildCheckView } from "../../../../shared/design-contract.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import type { DrawingBoardContent } from "../content.js";
import { ConfirmAction } from "../ConfirmAction.js";
import { NumberField, SelectField } from "../fields.js";
import { limitRows } from "../rebuildView.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Panel } from "./Panel.js";

type RebuildAction = "STANDARD" | "REARMAMENT" | "BULGE";

const REBUILD_ACTIONS: readonly { readonly value: RebuildAction; readonly label: string }[] = [
  { value: "STANDARD", label: "Standard rebuild" },
  { value: "REARMAMENT", label: "Armament change" },
  { value: "BULGE", label: "Bulge (add torpedo blister)" },
];

export function RebuildPanel({
  sessionId,
  draft,
  content,
  onLoad,
  dirty,
}: {
  readonly sessionId?: string;
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly onLoad: (draft: DesignDraft) => void;
  readonly dirty: boolean;
}) {
  const bridge = useBridge();
  const revision = useCampaignRevision();
  const format = usePresentationFormat();
  const [ships, setShips] = useState<readonly RebuildableShipView[]>([]);
  const [chosen, setChosen] = useState("");
  const [loaded, setLoaded] = useState<{ shipId: string } | null>(null);
  const [check, setCheck] = useState<RebuildCheckView | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [action, setAction] = useState<RebuildAction>("STANDARD");
  const [blisterMassKg, setBlisterMassKg] = useState(0);
  const ship = ships.find((s) => s.shipId === chosen) ?? ships[0];
  const shipId = ship?.shipId;
  const bulgeMassKg = action === "BULGE" ? Math.max(0, Math.floor(blisterMassKg)) : 0;
  const checkedDraft: DesignDraft =
    bulgeMassKg > 0
      ? {
          ...draft,
          hull: {
            ...draft.hull,
            targetDisplacementKg: kg(draft.hull.targetDisplacementKg + bulgeMassKg),
          },
        }
      : draft;
  const rebuildKind = action === "BULGE" ? ("BULGE" as const) : undefined;
  const checkedDraftJson = JSON.stringify(checkedDraft);

  useEffect(() => {
    setShips([]);
    if (!bridge || sessionId === undefined) return;
    let live = true;
    void bridge.campaign.execute("listRebuildableShips", sessionId).then((r) => {
      if (live && r.outcome === "success") setShips(r.value);
    });
    return () => {
      live = false;
    };
  }, [bridge, sessionId]);

  useEffect(() => {
    setCheck(null);
    if (!bridge || sessionId === undefined || shipId === undefined) return;
    if (loaded?.shipId !== shipId) return;
    let live = true;
    void bridge.campaign
      .execute("checkRebuild", {
        sessionId,
        shipId,
        draft: JSON.parse(checkedDraftJson) as Record<string, unknown>,
        ...(rebuildKind === undefined ? {} : { rebuildKind }),
      })
      .then((r) => {
        if (live && r.outcome === "success") setCheck(r.value);
      });
    return () => {
      live = false;
    };
  }, [bridge, sessionId, shipId, loaded, checkedDraftJson, rebuildKind]);

  const rules = content.rebuild;
  if (rules === null) {
    return (
      <Panel title="Rebuild a ship">
        <p className="text-sm text-muted-foreground">This ruleset has no rebuild rules.</p>
      </Panel>
    );
  }
  if (sessionId === undefined || !bridge) {
    return (
      <Panel title="Rebuild a ship">
        <p className="text-sm text-muted-foreground">
          Open a campaign to rebuild one of its ships.
        </p>
      </Panel>
    );
  }
  if (ship === undefined) {
    return (
      <Panel title="Rebuild a ship">
        <p className="text-sm text-muted-foreground">
          None of your ships can be rebuilt yet. A ship can be rebuilt once it is built from one of
          your own designs, is not being built or rebuilt, and is not in a battle.
        </p>
      </Panel>
    );
  }

  const isLoaded = loaded?.shipId === ship.shipId;
  const load = async () => {
    const r = await bridge.campaign.execute("loadShipDraft", {
      sessionId,
      shipId: ship.shipId,
    });
    if (r.outcome === "success") {
      onLoad(r.value.draft as unknown as DesignDraft);
      setLoaded({ shipId: ship.shipId });
      setResult(null);
    } else
      setResult({
        tone: "bad",
        text: (r.diagnostics.length > 0 ? r.diagnostics : [r.reason]).join(" "),
      });
  };

  const canStart = isLoaded && check !== null && check.legal && revision !== null && !busy;
  const start = async () => {
    if (revision === null) return;
    setBusy(true);
    try {
      const r = await bridge.campaign.execute("startRebuildCommand", {
        ...envelopeOf(sessionId, stampCommand("rebuild", revision)),
        shipId: ship.shipId,
        draft: checkedDraft as unknown as Record<string, unknown>,
        ...(rebuildKind === undefined ? {} : { rebuildKind }),
      });
      setResult(
        r.outcome === "success"
          ? {
              tone: "ok",
              text: `Rebuild of ${ship.name} queued. It starts when the month is committed; the ship is unavailable until the rebuild is finished.`,
            }
          : {
              tone: "bad",
              text: (r.diagnostics.length > 0 ? r.diagnostics : [r.reason]).join(" "),
            },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Rebuild a ship">
      <SelectField
        label="Ship to rebuild"
        value={ship.shipId}
        options={ships.map((s) => ({ value: s.shipId, label: `${s.name} (${s.className})` }))}
        onChange={(id) => {
          setChosen(id);
          setResult(null);
        }}
      />
      <Attachment aria-label="Selected ship to rebuild" state={isLoaded ? "done" : "idle"}>
        <AttachmentMedia>
          <Ship />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{ship.name}</AttachmentTitle>
          <AttachmentDescription>{ship.className} · design on file</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>Rebuild action</span>
        <select
          aria-label="Rebuild action"
          className="block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
          value={action}
          onChange={(event) => {
            setAction(event.target.value as RebuildAction);
            setResult(null);
          }}
        >
          {REBUILD_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <ConfirmAction
        variant="outline"
        confirm={dirty}
        title="Replace your design?"
        description="Loading this ship's design replaces the design you are working on, and its edit history is cleared."
        confirmLabel="Replace my design"
        onConfirm={() => void load()}
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
          onCommit={setBlisterMassKg}
          className="max-w-48"
        />
      )}

      {!isLoaded ? (
        <p className="text-sm text-muted-foreground">
          Load the ship&apos;s design, change it on the board, and the rebuild check appears here.
        </p>
      ) : check === null ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : (
        <div role="status" className="space-y-2 text-sm">
          <p className="font-medium">
            <Badge variant={check.legal ? "secondary" : "destructive"}>
              {check.legal ? "Rebuild allowed" : "Rebuild not allowed"}
            </Badge>
            {check.changesNothing && (
              <span className="ml-2 font-normal text-muted-foreground">
                The design is the same as the ship&apos;s: change something first.
              </span>
            )}
          </p>
          {action === "BULGE" && (
            <div className="rounded-md border p-2 text-xs" aria-label="Bulge projection">
              <p className="font-medium">Bulge (torpedo blister)</p>
              <p className="text-muted-foreground">
                A bulge is added hull mass: it raises torpedo protection at a price in speed.
              </p>
              <dl className="mt-1 grid grid-cols-2 gap-x-3">
                <dt className="text-muted-foreground">Blister mass</dt>
                <dd className="text-right tabular-nums">
                  {format.measurement(bulgeMassKg, "mass", { maximumFractionDigits: 0 })}
                </dd>
                {check.bulgeProtectionGainBp !== null && (
                  <>
                    <dt className="text-muted-foreground">Torpedo protection</dt>
                    <dd className="text-right tabular-nums">
                      +{format.percent(check.bulgeProtectionGainBp, 1)}
                    </dd>
                  </>
                )}
                {check.measures !== null && (
                  <>
                    <dt className="text-muted-foreground">Speed</dt>
                    <dd className="text-right tabular-nums">
                      {format.number(check.measures.speedChangeMilliKnots / 1000, {
                        maximumFractionDigits: 1,
                      })}{" "}
                      kn
                    </dd>
                    <dt className="text-muted-foreground">Displacement</dt>
                    <dd className="text-right tabular-nums">
                      {format.percent(check.measures.displacementChangeBp, 1)}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}
          {check.measures !== null && (
            <table className="w-full text-xs" aria-label="Rebuild limits">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-normal">Limit</th>
                  <th className="py-1 font-normal">Your change</th>
                  <th className="py-1 font-normal">A rebuild may</th>
                </tr>
              </thead>
              <tbody>
                {limitRows(check.measures, rules, format).map((row) => (
                  <tr key={row.id} className="border-t">
                    <th scope="row" className="py-1 text-left font-normal">
                      {row.label}
                    </th>
                    <td
                      className={
                        row.over ? "py-1 font-medium text-destructive" : "py-1 tabular-nums"
                      }
                    >
                      {row.change}
                      {row.over ? " (over the limit)" : ""}
                    </td>
                    <td className="py-1 text-muted-foreground">{row.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {check.designProblems.length > 0 && (
            <div>
              <p className="font-medium">The design itself cannot be built:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {check.designProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {check.findings.map((f) => (
            <div key={f.id} className="space-y-1 rounded-md border p-2">
              <p className="font-medium">{f.what}</p>
              <p className="text-muted-foreground">{f.why}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {f.remedies.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <ConfirmAction
        confirm
        disabled={!canStart}
        title={`Start rebuilding ${ship.name}?`}
        description={`${ship.name} will be unavailable from the next month until the rebuild is finished: it cannot sail, train or fight. The old design stays on record. It is queued now and starts when the month is committed.`}
        confirmLabel="Queue the rebuild"
        onConfirm={() => void start()}
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
    </Panel>
  );
}
