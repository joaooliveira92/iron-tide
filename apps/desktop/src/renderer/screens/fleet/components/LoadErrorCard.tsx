import { memo } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";

export interface LoadErrorCardProps {
  readonly message: string;
  readonly onReload: () => void;
}

export const LoadErrorCard = memo(function LoadErrorCard({
  message,
  onReload,
}: LoadErrorCardProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fleet</h2>
      </div>
      <Alert variant="destructive">
        <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={onReload}>
        Reload
      </Button>
    </div>
  );
});
