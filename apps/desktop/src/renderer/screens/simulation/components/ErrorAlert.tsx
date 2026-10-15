import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "../../../components/ui/alert.js";

import { cn } from "../../../lib/utils.js";

export interface ErrorAlertProps {
  readonly message: string;
  readonly className?: string;
  readonly fontMono?: boolean;
}

export function ErrorAlert({ message, className, fontMono }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className={cn(fontMono && "font-mono")}>{message}</AlertDescription>
    </Alert>
  );
}
