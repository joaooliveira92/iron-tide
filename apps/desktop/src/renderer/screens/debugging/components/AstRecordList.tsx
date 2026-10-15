import { Database } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { cn } from "../../../lib/utils.js";
import type { CompiledRecord } from "../types.js";

export interface AstRecordListProps {
  readonly records: readonly CompiledRecord[];
  readonly selectedRecord: CompiledRecord | null;
  readonly onSelectRecord: (record: CompiledRecord) => void;
}

export function AstRecordList({ records, selectedRecord, onSelectRecord }: AstRecordListProps) {
  return (
    <ScrollArea className="col-span-2 rounded-md border">
      {records.length === 0 ? (
        <Empty className="h-full border-none">
          <EmptyIcon>
            <Database />
          </EmptyIcon>
          <EmptyTitle>No matching records</EmptyTitle>
          <EmptyDescription>Nothing compiled matches this search.</EmptyDescription>
        </Empty>
      ) : (
        <div className="divide-y text-xs">
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => onSelectRecord(record)}
              className={cn(
                "block w-full cursor-pointer truncate p-2 text-left font-mono hover:bg-muted",
                selectedRecord?.id === record.id && "bg-accent text-accent-foreground",
              )}
            >
              <div className="truncate text-[11px] font-medium">{record.id}</div>
              <Badge variant="secondary" className="mt-0.5 text-[11px]">
                {record.kind}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
