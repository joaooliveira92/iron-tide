import { memo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";

export interface LoadErrorCardProps {
  readonly message: string;
  readonly onReload: () => void;
}

export const LoadErrorCard = memo(function LoadErrorCard({
  message,
  onReload,
}: LoadErrorCardProps) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="space-y-3 p-4">
        <p className="whitespace-pre-line text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onReload}>
          <RefreshCw className="h-3.5 w-3.5" />
          Reload
        </Button>
      </CardContent>
    </Card>
  );
});
