import { AlertCircle, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { Skeleton } from "../ui/skeleton.js";
import { ScreenStage } from "./ScreenStage.js";

export interface ScreenLoadStateProps {
  readonly guidedTarget: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

export interface ScreenLoadErrorStateProps extends ScreenLoadStateProps {
  readonly errorTitle: string;
  readonly message: string;
  readonly onRetry: () => void;
}

export function ScreenLoadingState({
  guidedTarget,
  icon,
  title,
  description,
}: ScreenLoadStateProps) {
  return (
    <ScreenStage guidedTarget={guidedTarget} icon={icon} title={title} description={description}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <Skeleton key={idx} className="h-28" />
        ))}
      </div>
    </ScreenStage>
  );
}

export function ScreenLoadErrorState({
  guidedTarget,
  icon,
  title,
  description,
  errorTitle,
  message,
  onRetry,
}: ScreenLoadErrorStateProps) {
  return (
    <ScreenStage guidedTarget={guidedTarget} icon={icon} title={title} description={description}>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{errorTitle}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span className="whitespace-pre-wrap">{message}</span>
          <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </ScreenStage>
  );
}
