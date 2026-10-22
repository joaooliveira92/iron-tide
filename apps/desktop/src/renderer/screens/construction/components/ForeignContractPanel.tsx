import { memo } from "react";
import type { ForeignConstructionPreview } from "@bluewave/phase-engine";
import { Alert, AlertDescription } from "../../../components/ui/alert.js";
import { Badge } from "../../../components/ui/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";

/**
 * The foreign construction contract panel (SB3-R20/R23/R34; INC-9b). Presentational: every figure is the engine's
 * compiled preview (dock ceiling, free `NEW_CONSTRUCTION` capacity, capability verdict, tension-scaled impoundment risk,
 * delivery guarantee, contract terms and payment schedule). It authors no number and invents no reason code.
 *
 * The delivery guarantee is always "none" today: INC-10 recorded that no treaty/contract-clause source exists yet, so
 * the panel states the guarantee is absent rather than fabricating one.
 */
export interface ForeignContractPanelProps {
  readonly preview: ForeignConstructionPreview;
  /** The chosen builder nation id; the panel reads its candidate and the contract terms from the preview. */
  readonly builderNationId: string;
}

const RELATION_LABEL: Readonly<Record<string, string>> = {
  neutral: "neutral",
  allied: "allied",
  at_war: "at war",
  trade_agreement: "trade agreement",
};

export const ForeignContractPanel = memo(function ForeignContractPanel({
  preview,
  builderNationId,
}: ForeignContractPanelProps) {
  const format = usePresentationFormat();
  const builder = preview.builders.find((b) => b.nationId === builderNationId);
  const contract = preview.contract;
  if (builder === undefined) return null;

  return (
    <Card data-testid="foreign-contract-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Foreign yard: {builder.name}
          {builder.tag !== builder.name && (
            <span className="ml-1 text-muted-foreground">({builder.tag})</span>
          )}
        </CardTitle>
        <CardDescription>
          {builder.relation === null
            ? "No recorded relation with this yard."
            : `Relation: ${RELATION_LABEL[builder.relation] ?? builder.relation}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul aria-label="Builder capability" className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground">Dock ceiling</span>
            <span className="font-mono tabular-nums" data-testid="foreign-dock-ceiling">
              {builder.dockCeilingKg === null
                ? "no dock"
                : format.measurement(builder.dockCeilingKg, "mass", {
                    maximumFractionDigits: 0,
                  })}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground">Free capacity</span>
            <span className="font-mono tabular-nums" data-testid="foreign-free-capacity">
              {format.measurement(builder.availableNewConstructionMassKg, "mass", {
                maximumFractionDigits: 0,
              })}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground">Fits dock</span>
            <span data-testid="foreign-fits-dock">{builder.fitsDock ? "yes" : "no"}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground">Impoundment risk</span>
            <span className="font-mono tabular-nums" data-testid="foreign-impoundment-risk">
              {format.percent(builder.impoundmentRiskBp, 1)}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground">Delivery guarantee</span>
            <span data-testid="foreign-delivery-guarantee">
              {builder.deliveryGuarantee ? "guaranteed" : "none"}
            </span>
          </li>
        </ul>

        {builder.capabilitySatisfied ? (
          <div role="status" className="text-xs text-muted-foreground">
            <Badge variant="secondary">Builder can build this hull</Badge>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertDescription className="space-y-1">
              <span data-testid="foreign-refusal">
                {builder.capabilityFailureCode ?? "The engine could not certify this builder."}
              </span>
              <ul className="list-disc pl-5 text-xs">
                {builder.capabilityReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {contract !== null && (
          <div className="space-y-2" data-testid="foreign-contract-terms">
            <p className="text-xs text-muted-foreground">
              {format.count(contract.quantity)} × {format.count(contract.totalWorkPerUnit)} ={" "}
              <span className="font-mono" data-testid="foreign-total-price">
                {format.money(contract.totalPriceUnits)}
              </span>{" "}
              total · keel {contract.plannedKeelMonth} · delivery {contract.plannedDeliveryMonth}
            </p>
            {contract.capacityReservationSchedule.map((reservation) => (
              <p
                key={reservation.month}
                data-testid="foreign-capacity-reservation"
                className="text-xs text-muted-foreground"
              >
                Reserves{" "}
                {format.measurement(reservation.reservedMassKg, "mass", {
                  maximumFractionDigits: 0,
                })}{" "}
                of {reservation.pool} capacity in {reservation.month}.
              </p>
            ))}
            <table className="w-full text-xs" aria-label="Foreign payment schedule">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-normal">Due</th>
                  <th className="py-1 text-right font-normal">Amount</th>
                  <th className="py-1 text-right font-normal">Work</th>
                </tr>
              </thead>
              <tbody>
                {contract.paymentSchedule.map((installment) => (
                  <tr key={installment.dueMonth} className="border-t">
                    <td className="py-1 font-mono">{installment.dueMonth}</td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {format.money(installment.amountUnits)}
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {format.percent(installment.workShareBp, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">
              {contract.paymentGraceMonths === 1
                ? "One month"
                : `${format.count(contract.paymentGraceMonths)} months`}{" "}
              of grace after each due date; an unpaid instalment holds the work at zero and, once
              the grace lapses, delays the contract (payment default).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
