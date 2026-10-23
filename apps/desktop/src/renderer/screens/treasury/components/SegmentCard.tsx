import { cn } from "../../../lib/utils.js";

export interface SegmentCardProps {
  readonly swatchClassName?: string;
  readonly title: string;
  readonly amount: string;
  readonly description: string;
  readonly facts?: readonly { readonly label: string; readonly value: string }[];
  readonly note?: string | null;
}

export function SegmentCard({
  swatchClassName,
  title,
  amount,
  description,
  facts = [],
  note = null,
}: SegmentCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-medium">
          {swatchClassName !== undefined && (
            <span aria-hidden="true" className={cn("size-2.5 rounded-sm", swatchClassName)} />
          )}
          {title}
        </span>
        <span className="font-medium tabular-nums">{amount}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {facts.length > 0 && (
        <dl className="space-y-0.5 border-t pt-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {note !== null && <p className="border-t pt-2 text-xs">{note}</p>}
    </div>
  );
}
