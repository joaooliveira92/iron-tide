import { memo } from "react";
import { Card, CardContent } from "../../../components/ui/card.js";

export interface ErrorStateProps {
  readonly message: string;
}

export const ErrorState = memo(function ErrorState({ message }: ErrorStateProps) {
  return (
    <Card className="border-destructive/50" role="status" aria-live="polite">
      <CardContent className="p-4 text-destructive">{message}</CardContent>
    </Card>
  );
});
