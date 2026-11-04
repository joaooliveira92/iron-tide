import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "../../../components/ui/alert.js";

import { cn } from "../../../lib/utils.js";

export type ErrorAlertVariant = "default" | "technical";

export interface ErrorAlertProps {
  readonly message: string;
  readonly className?: string;
  readonly variant?: ErrorAlertVariant;
}

export function ErrorAlert({ message, className, variant = "default" }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className={cn(variant === "technical" && "font-mono")}>
        {message}
      </AlertDescription>
    </Alert>
  );
}
