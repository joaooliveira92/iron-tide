import { memo } from "react";
import { RefreshCw, Send } from "lucide-react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { Alert, AlertDescription } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { RadioGroup } from "../../../components/ui/radio-group.js";
import { DesignCard } from "./DesignCard.js";

export interface DesignPickerProps {
  readonly designs: readonly CompiledDesignVersion[];
  readonly selectedDesignId: string | null;
  readonly onSelectDesign: (designId: string) => void;
  readonly onSubmit: () => void;
  readonly onRefresh: () => void;
  readonly busy: boolean;
  readonly hasPendingRequest: boolean;
  readonly onRetry: (() => void) | undefined;
  readonly notice: string | null;
}

export const DesignPicker = memo(function DesignPicker({
  designs,
  selectedDesignId,
  onSelectDesign,
  onSubmit,
  onRefresh,
  busy,
  hasPendingRequest,
  onRetry,
  notice,
}: DesignPickerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Design Catalog</CardTitle>
        <CardDescription>
          Select an approved design to submit, replace, or reissue a command.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {designs.length === 0 ? (
          <Empty>
            <EmptyIcon />
            <EmptyTitle>No approved designs</EmptyTitle>
            <EmptyDescription>No approved design is available for this campaign.</EmptyDescription>
          </Empty>
        ) : (
          <RadioGroup
            value={selectedDesignId}
            onValueChange={(value) => onSelectDesign(value as string)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {designs.map((design) => (
              <DesignCard key={design.designId} design={design} />
            ))}
          </RadioGroup>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ButtonGroup>
            <Button
              variant="default"
              size="sm"
              onClick={onSubmit}
              disabled={busy || selectedDesignId === null}
            >
              <Send className="h-3.5 w-3.5" />
              Submit Construction Command
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </ButtonGroup>
          {hasPendingRequest && onRetry !== undefined && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry Pending Request
            </Button>
          )}
        </div>

        {notice !== null && (
          <Alert>
            <AlertDescription className="whitespace-pre-line">{notice}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
});
