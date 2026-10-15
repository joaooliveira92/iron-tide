import { memo } from "react";
import { Card, CardContent } from "../../../components/ui/card.js";

export interface LoadingStateProps {
  readonly message?: string;
}

export const LoadingState = memo(function LoadingState({
  message = "Loading…",
}: LoadingStateProps) {
  return (
    <Card role="status" aria-live="polite">
      <CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
});
