import { CalendarClock, Check, ScrollText, Swords, X } from "lucide-react";
import type { DiplomacyScreenProjection } from "../../../../shared/diplomacy-contract.js";
import { Button } from "../../../components/ui/button.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.js";
import { NationFlag } from "./NationFlag.js";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import type { DiplomacyDraftCommand } from "../diplomacy-screen-state.js";

export interface OrdersBarProps {
  readonly busy: boolean;
  readonly queued: boolean;
  readonly areas: DiplomacyScreenProjection["areas"];
  readonly draft: DiplomacyDraftCommand | null;
  readonly draftLabel: string | null;
  readonly draftFlagUrl: string | null;
  readonly canSubmit: boolean;
  readonly onAreaChange: (areaId: string) => void;
  readonly onClear: () => void;
  readonly onApply: () => void;
}

export function OrdersBar({
  busy,
  queued,
  areas,
  draft,
  draftLabel,
  draftFlagUrl,
  canSubmit,
  onAreaChange,
  onClear,
  onApply,
}: OrdersBarProps) {
  const declaringWar = draft?.kind === "DeclareWar" && !queued;
  return (
    <div
      role="group"
      aria-label="Orders"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 basis-[22rem] flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ScrollText aria-hidden="true" className="size-4" />
          Next order
        </span>
        {draft === null ? (
          <span className="text-sm text-muted-foreground">
            Nothing drafted. Pick an action in a nation's dossier.
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            {queued && <Check aria-hidden="true" className="size-4 shrink-0 text-success" />}
            {draftFlagUrl !== null && (
              <NationFlag
                url={draftFlagUrl}
                name={draftLabel ?? ""}
                className="h-5 w-8 rounded-[3px] border border-border"
              />
            )}
            <span className="truncate">{draftLabel}</span>
            {queued && <span className="shrink-0 font-normal text-muted-foreground">queued</span>}
          </span>
        )}
        {draft?.kind === "DeclareBlockade" && !queued && (
          <Select
            value={draft.areaId}
            onValueChange={(areaId) => onAreaChange(areaId)}
            disabled={busy}
            className="w-52"
          >
            <SelectTrigger aria-label="Blockade area">
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.areaId} value={area.areaId}>
                  {DEBUG_MODE ? `${area.name} (${area.areaId})` : area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span
          role="note"
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title="Orders are applied by the engine on the next turn advance."
        >
          <CalendarClock aria-hidden="true" className="size-3.5" />
          Applied on the next turn advance
        </span>
        <Button variant="outline" disabled={draft === null || busy} onClick={onClear}>
          <X aria-hidden="true" className="mr-1 size-4" />
          Clear
        </Button>
        <Button
          variant={declaringWar ? "destructive" : "default"}
          disabled={!canSubmit || busy}
          onClick={onApply}
        >
          {declaringWar ? (
            <Swords aria-hidden="true" className="mr-1 size-4" />
          ) : (
            <Check aria-hidden="true" className="mr-1 size-4" />
          )}
          {busy ? "Submitting…" : declaringWar ? "Declare war" : "Submit command"}
        </Button>
      </div>
      {declaringWar && (
        <p role="alert" className="basis-full text-xs font-medium text-destructive">
          Once submitted, a declaration of war cannot be cancelled from this screen. It takes effect
          when you advance the month.
        </p>
      )}
    </div>
  );
}
