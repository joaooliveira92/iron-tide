import { Check, Copy } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import type { CompiledRecord } from "../types.js";

export interface AstRecordPreviewProps {
  readonly record: CompiledRecord | null;
  readonly copied: boolean;
  readonly onCopy: () => void;
}

export function AstRecordPreview({ record, copied, onCopy }: AstRecordPreviewProps) {
  return (
    <div className="relative col-span-3 overflow-hidden rounded-md border bg-zinc-950 text-zinc-50">
      {record === null ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-500">
          Select a record to inspect its compiled AST
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="absolute right-1.5 top-1.5 h-7 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <ScrollArea className="h-full">
            <pre className="whitespace-pre-wrap break-words p-2 pr-16 font-mono text-[12px]">
              {JSON.stringify(record.data, null, 2)}
            </pre>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
