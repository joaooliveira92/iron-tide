import { useRef } from "react";

import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { resolveMessage } from "../../content/uiCatalogue.js";

export type OfferChoice = "accept" | "delegate" | "decline";

const UNAVOIDABLE_CLASS = "OPERATIONALLY_UNAVOIDABLE";

export function OfferDialog({
  request,
  onChoose,
  onAbandon,
}: {
  readonly request: InterruptionRequestDto;
  readonly onChoose: (choice: OfferChoice) => void;
  readonly onAbandon: () => void;
}) {
  const acceptRef = useRef<HTMLButtonElement>(null);
  const interpolation = request.interpolation;
  const mission = request.missionType ?? "";
  const acceptanceClass = request.acceptanceClass ?? "";
  const estimate = request.estimate;
  const declineRefused = acceptanceClass === UNAVOIDABLE_CLASS;
  const rows: readonly (readonly [string, string])[] = [
    [resolveMessage("ui.offer.field.mission"), resolveMessage(`ui.offer.mission.${mission}`)],
    [resolveMessage("ui.offer.field.class"), resolveMessage(`ui.offer.class.${acceptanceClass}`)],
    [resolveMessage("ui.offer.field.area"), request.areaId ?? ""],
    [
      resolveMessage("ui.offer.field.sides"),
      resolveMessage("ui.offer.sides.value", {
        attackerId: request.attackerId ?? "",
        defenderId: request.defenderId ?? "",
      }),
    ],
    [
      resolveMessage("ui.offer.field.yourSide"),
      resolveMessage(`ui.offer.side.${request.playerSide ?? "ATTACKER"}`),
    ],
  ];
  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent
        data-testid="offer-dialog"
        aria-modal="true"
        initialFocus={acceptRef}
        className="max-w-md gap-3 p-4"
      >
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="text-sm">
            {resolveMessage(request.titleKey, interpolation)}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {resolveMessage(request.bodyKey, interpolation)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="offer-force-heading">
          <h3 id="offer-force-heading" className="text-xs font-semibold">
            {resolveMessage("ui.offer.force.heading")}
          </h3>
          <ul className="mt-1 space-y-0.5 text-xs" data-testid="offer-force">
            {(request.playerForce ?? []).map((ship) => (
              <li key={ship.shipId}>
                {resolveMessage("ui.offer.force.ship", {
                  name: ship.name,
                  classId: ship.classId,
                })}
              </li>
            ))}
          </ul>
        </section>
        {estimate !== undefined && (
          <p className="text-xs font-medium" data-testid="offer-estimate">
            {resolveMessage(`ui.offer.estimate.${estimate.model}`, {
              strength: estimate.strength,
            })}
          </p>
        )}
        <p className="text-xs" data-testid="offer-support">
          {request.supportForcePresent !== true
            ? resolveMessage("ui.offer.support.absent")
            : (request.supportNationIds ?? []).length > 0
              ? resolveMessage("ui.offer.support.presentFrom", {
                  nations: (request.supportNationIds ?? []).join(", "),
                })
              : resolveMessage("ui.offer.support.present")}
        </p>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            ref={acceptRef}
            type="button"
            size="sm"
            data-testid="offer-accept"
            onClick={() => onChoose("accept")}
          >
            {resolveMessage("ui.offer.accept")}
          </Button>
          <p className="text-xs text-muted-foreground">{resolveMessage("ui.offer.accept.hint")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="offer-delegate"
            onClick={() => onChoose("delegate")}
          >
            {resolveMessage("ui.offer.delegate")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {resolveMessage("ui.offer.delegate.hint")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="offer-decline"
            aria-disabled={declineRefused}
            aria-describedby="offer-decline-statement"
            onClick={() => {
              if (!declineRefused) onChoose("decline");
            }}
          >
            {resolveMessage("ui.offer.decline")}
          </Button>
          <div id="offer-decline-statement" className="text-xs text-muted-foreground">
            {declineRefused ? (
              <p data-testid="offer-decline-reason">
                {resolveMessage("ui.offer.decline.unavoidable")}
              </p>
            ) : null}
            {(request.declineStatementKeys ?? []).map((key) => (
              <p key={key}>{resolveMessage(key)}</p>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="offer-abandon"
            onClick={onAbandon}
          >
            {resolveMessage("ui.offer.abandon")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
