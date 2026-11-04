import { resolveMessage } from "../../../content/uiCatalogue.js";
import { SummaryList, SummarySection } from "../components/summary/index.js";
import { categoryLabelKey } from "../turn-summary-format.js";
import { TurnSummaryMessageRow } from "./TurnSummaryMessageRow.js";
import { useTurnSummaryMeta } from "./TurnSummaryContext.js";

export function TurnSummaryGroups() {
  const { groups, pinnedIds, readIds } = useTurnSummaryMeta();

  return (
    <>
      {groups.map((group) => (
        <SummarySection
          key={group.category}
          variant="turn"
          testId="turn-message-group"
          category={group.category}
          title={resolveMessage(categoryLabelKey(group.category))}
          count={group.messages.length}
        >
          <SummaryList variant="turn">
            {group.messages.map((message) => (
              <TurnSummaryMessageRow
                key={message.id}
                message={message}
                pinned={pinnedIds.has(message.id)}
                read={readIds.has(message.id)}
              />
            ))}
          </SummaryList>
        </SummarySection>
      ))}
    </>
  );
}
