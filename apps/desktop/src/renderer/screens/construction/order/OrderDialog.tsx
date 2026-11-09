import { Minus, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { useConstructionActions, useConstructionState } from "../workspace/ConstructionContext.js";
import {
  ORDER_QUANTITY_MAX,
  ORDER_QUANTITY_MIN,
  type OrderBuilderOption,
  type OrderSummary,
} from "./order-view-model.js";

function monthsLabel(months: number | null): string {
  if (months === null) return "Unknown";
  return `${months} ${months === 1 ? "month" : "months"}`;
}

function SummaryRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function BuilderChoice({
  option,
  selected,
  onSelect,
}: {
  readonly option: OrderBuilderOption;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const format = usePresentationFormat();
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm has-checked:border-primary/60 has-checked:bg-accent">
      <input
        type="radio"
        name="order-builder"
        className="mt-1"
        checked={selected}
        onChange={onSelect}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-4">
          <span className="font-medium">
            {option.label}
            {option.relation !== null && (
              <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                {option.relation.replaceAll("_", " ")}
              </span>
            )}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {option.priceUnits === null ? "Quoting" : format.money(option.priceUnits)}
            {" · "}
            {monthsLabel(option.months)}
          </span>
        </span>
        {option.refusal !== null && (
          <span className="text-xs text-destructive">{option.refusal}</span>
        )}
      </span>
    </label>
  );
}

function SummaryPanel({ summary }: { readonly summary: OrderSummary | null }) {
  const format = usePresentationFormat();
  return (
    <section aria-label="Order summary" className="space-y-2 rounded-md border bg-muted/40 p-3">
      {summary === null ? (
        <p className="text-sm text-muted-foreground">No quote yet.</p>
      ) : (
        <dl className="space-y-1">
          <SummaryRow label="Builder" value={summary.builderLabel} />
          <SummaryRow label="Total price" value={format.money(summary.totalPrice)} />
          <SummaryRow label="Build time" value={monthsLabel(summary.months)} />
          <SummaryRow label="Monthly instalment" value={format.money(summary.instalment)} />
          <SummaryRow label="Delivery" value={summary.deliveryMonth ?? "Unknown"} />
          <SummaryRow label="Treasury after" value={format.money(summary.treasuryAfter)} />
        </dl>
      )}
    </section>
  );
}

export function OrderDialog() {
  const { order } = useConstructionState();
  const { closeOrderDialog, setOrderQuantity, setOrderBuilder, placeOrder } =
    useConstructionActions();
  const { open, design, className, study, quantity, builderNationId, fetching, model } = order;
  const inStudy = model.status === "study";
  const canPlace = model.status === "ready" && !fetching;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : closeOrderDialog())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Order ships</DialogTitle>
          <DialogDescription>
            Choose the builder and quantity; placing the order commits the price shown.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-5">
            <section aria-label="Design" className="space-y-1">
              <h3 className="text-sm font-medium">Design</h3>
              <p className="text-sm">
                {className}
                {design !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {design.shipType.replaceAll("_", " ")}
                  </span>
                )}
              </p>
              {study !== null && (
                <p className="text-xs text-muted-foreground">
                  In design study until {study.readyMonth}.
                </p>
              )}
            </section>
            {!inStudy && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Builder</h3>
                  <div
                    role="radiogroup"
                    aria-label="Builder"
                    className="max-h-40 space-y-1.5 overflow-y-auto pr-1"
                  >
                    {model.builders.map((option) => (
                      <BuilderChoice
                        key={option.id ?? "home"}
                        option={option}
                        selected={option.id === builderNationId}
                        onSelect={() => setOrderBuilder(option.id)}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Quantity</h3>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Decrease quantity"
                      disabled={quantity <= ORDER_QUANTITY_MIN}
                      onClick={() => setOrderQuantity(quantity - 1)}
                    >
                      <Minus aria-hidden="true" />
                    </Button>
                    <output
                      aria-label="Quantity"
                      className="w-8 text-center font-mono text-sm tabular-nums"
                    >
                      {quantity}
                    </output>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Increase quantity"
                      disabled={quantity >= ORDER_QUANTITY_MAX}
                      onClick={() => setOrderQuantity(quantity + 1)}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {ORDER_QUANTITY_MIN} to {ORDER_QUANTITY_MAX} ships
                    </span>
                  </div>
                </div>
                <SummaryPanel summary={model.summary} />
              </>
            )}
            {model.reason !== null && (
              <p role="note" id="order-reason" className="text-sm text-destructive">
                {model.reason}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={closeOrderDialog}>
            Cancel
          </Button>
          <Button
            disabled={!canPlace}
            aria-describedby={model.reason === null ? undefined : "order-reason"}
            onClick={placeOrder}
          >
            Place order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
