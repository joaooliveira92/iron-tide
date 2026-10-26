import { cn } from "../../../lib/utils.js";
import { SlateBody, SlateFacts, SlateFoot, SlateHeader } from "../../../components/ui/slate.js";

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
    <>
      <SlateHeader
        title={title}
        {...(swatchClassName === undefined
          ? {}
          : { icon: <span className={cn("size-2.5 rounded-sm", swatchClassName)} /> })}
        aside={<span className="font-display text-sm font-semibold tabular-nums">{amount}</span>}
      />
      <SlateBody>
        <p className="text-xs text-muted-foreground">{description}</p>
        {facts.length > 0 && <SlateFacts rows={facts} className="border-t border-border/60 pt-2" />}
      </SlateBody>
      {note !== null && <SlateFoot>{note}</SlateFoot>}
    </>
  );
}
