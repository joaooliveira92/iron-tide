import { Database } from "lucide-react";
import type { Ref } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Kbd } from "../../../components/ui/kbd.js";
import type { CompiledRecord } from "../types.js";
import { AstRecordList } from "./AstRecordList.js";
import { AstRecordPreview } from "./AstRecordPreview.js";
import { SearchInput } from "./SearchInput.js";

export interface AstInspectorProps {
  readonly records: readonly CompiledRecord[];
  readonly searchTerm: string;
  readonly selectedRecord: CompiledRecord | null;
  readonly copied: boolean;
  readonly searchRef: Ref<HTMLInputElement>;
  readonly onSearchChange: (term: string) => void;
  readonly onSelectRecord: (record: CompiledRecord) => void;
  readonly onCopy: () => void;
}

export function AstInspector({
  records,
  searchTerm,
  selectedRecord,
  copied,
  searchRef,
  onSearchChange,
  onSelectRecord,
  onCopy,
}: AstInspectorProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 font-semibold">
          <Database className="h-4 w-4 text-primary" />
          Content Pack AST Inspector (Records)
        </CardTitle>
        <CardDescription className="text-xs">
          Direct presentation layer over compiled compiler records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchInput
          placeholder="Search records by ID or Kind…"
          value={searchTerm}
          onChange={onSearchChange}
          inputRef={searchRef}
          inputClassName="pr-10"
          rightElement={<Kbd className="absolute right-2 top-1.5">/</Kbd>}
        />

        <div className="grid h-80 grid-cols-5 gap-4">
          <AstRecordList
            records={records}
            selectedRecord={selectedRecord}
            onSelectRecord={onSelectRecord}
          />
          <AstRecordPreview record={selectedRecord} copied={copied} onCopy={onCopy} />
        </div>
      </CardContent>
    </Card>
  );
}
