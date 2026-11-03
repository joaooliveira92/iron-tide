import { Ship } from "lucide-react";
import type { RebuildableShipView } from "../../../../../shared/design-contract.js";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  type AttachmentState,
} from "../../../ui/attachment.js";

export function RebuildShipCard({
  ship,
  state,
}: {
  readonly ship: RebuildableShipView;
  readonly state: AttachmentState;
}) {
  return (
    <Attachment aria-label="Selected ship to rebuild" state={state}>
      <AttachmentMedia>
        <Ship />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{ship.name}</AttachmentTitle>
        <AttachmentDescription>{ship.className} · design on file</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}
