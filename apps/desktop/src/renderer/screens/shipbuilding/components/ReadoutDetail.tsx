import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { SlateBody, SlateFacts, SlateHeader } from "../../../components/ui/slate.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import type { ReadoutExplanation, ReadoutRow } from "../engineering-status.js";

export function ReadoutDetail({
  title,
  rows,
  causes,
  footer,
  explanations,
  format,
}: {
  readonly title: string;
  readonly rows: readonly ReadoutRow[];
  readonly causes?: readonly string[];
  readonly footer?: readonly ReadoutRow[];
  readonly explanations?: readonly ReadoutExplanation[];
  readonly format?: PresentationFormat;
}) {
  return (
    <>
      <SlateHeader title={title} />
      <SlateBody>
        <SlateFacts rows={rows} />
        {causes !== undefined && causes.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {causes.map((cause, i) => (
              <li key={i}>{cause}</li>
            ))}
          </ul>
        )}
        {footer !== undefined && (
          <SlateFacts
            rows={footer}
            className="border-t border-border/60 pt-2 [&_dd]:font-semibold"
          />
        )}
        {format !== undefined &&
          explanations?.map((explanation) => (
            <ExplanationDisclosure
              key={explanation.tree.formulaId}
              tree={explanation.tree}
              area={explanation.area}
              summaryKey={explanation.summaryKey}
              format={format}
            />
          ))}
      </SlateBody>
    </>
  );
}
