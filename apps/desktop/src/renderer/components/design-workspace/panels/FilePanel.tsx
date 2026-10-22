import { useRef, useState } from "react";
import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import { FileText } from "lucide-react";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "../../ui/attachment.js";
import { Alert } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { ButtonGroup } from "../../ui/button-group.js";
import type { DrawingBoardContent } from "../content.js";
import { designFileName, exportDesign, importDesign } from "../designFile.js";
import { ConfirmAction } from "../ConfirmAction.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Panel } from "./Panel.js";

/** Save the working design to a `.bwdesign` file, or open one as the working design (history resets). */
export function FilePanel({
  draft,
  view,
  content,
  presetName,
  onLoad,
  dirty,
}: {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly content: DrawingBoardContent;
  readonly presetName: string;
  readonly onLoad: (draft: DesignDraft) => void;
  readonly dirty: boolean;
}) {
  const format = usePresentationFormat();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{
    readonly name: string;
    readonly bytes: number;
    readonly how: "Saved" | "Opened";
    readonly state: "done" | "error";
  } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const save = () => {
    const text = exportDesign(draft, content.components, view.compiled);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = designFileName(presetName);
    setFile({ name: a.download, bytes: new Blob([text]).size, how: "Saved", state: "done" });
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "ok", text: `Saved ${a.download}.` });
  };
  const open = async (picked: File) => {
    const r = importDesign(await picked.text(), content.components);
    if (!r.ok) {
      setFile({ name: picked.name, bytes: picked.size, how: "Opened", state: "error" });
      return setMessage({ tone: "bad", text: r.error });
    }
    setFile({ name: picked.name, bytes: picked.size, how: "Opened", state: "done" });
    onLoad(r.draft);
    setMessage({ tone: "ok", text: ["Design opened.", ...r.notes].join(" ") });
  };
  return (
    <Panel title="Design file">
      <ButtonGroup aria-label="Design file actions">
        <Button variant="outline" onClick={save}>
          Save design file
        </Button>
        <ConfirmAction
          variant="outline"
          confirm={dirty}
          title="Open a design file?"
          description="Opening a file replaces the design you are working on, and its edit history is cleared. Save it first if you want to keep it."
          confirmLabel="Choose a file"
          onConfirm={() => input.current?.click()}
        >
          Open design file
        </ConfirmAction>
        <input
          ref={input}
          type="file"
          accept=".bwdesign,application/json"
          aria-label="Design file"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void open(f);
          }}
        />
      </ButtonGroup>
      {file !== null && (
        <Attachment state={file.state} aria-label="Last design file">
          <AttachmentMedia>
            <FileText />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
            <AttachmentDescription>
              {file.state === "error" ? "Could not be opened" : file.how} ·{" "}
              {format.number(file.bytes / 1024, { maximumFractionDigits: 1 })} KB
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      )}
      {message !== null && (
        <Alert role="status" variant={message.tone === "ok" ? "default" : "destructive"}>
          {message.text}
        </Alert>
      )}
    </Panel>
  );
}
