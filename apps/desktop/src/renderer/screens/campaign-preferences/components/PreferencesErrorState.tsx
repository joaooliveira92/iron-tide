import { memo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";

export interface PreferencesErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

export const PreferencesErrorState = memo(function PreferencesErrorState({
  message,
  onRetry,
}: PreferencesErrorStateProps) {
  return (
    <div className="space-y-6">
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 p-4 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load campaign: {message}</span>
        </CardContent>
      </Card>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
});
