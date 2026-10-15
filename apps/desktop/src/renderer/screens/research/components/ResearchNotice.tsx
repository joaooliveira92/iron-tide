import { CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert.js";

export interface ResearchNoticeProps {
  readonly submitted: boolean;
  readonly notice: string;
}

interface NoticePresentation {
  readonly Icon: LucideIcon;
  readonly title: string;
  readonly variant: "default" | "destructive";
}

const SUBMITTED_NOTICE: NoticePresentation = {
  Icon: CheckCircle2,
  title: "Priorities queued",
  variant: "default",
};

const NOT_APPLIED_NOTICE: NoticePresentation = {
  Icon: Info,
  title: "Not applied",
  variant: "destructive",
};

export function ResearchNotice({ submitted, notice }: ResearchNoticeProps) {
  const { Icon, title, variant } = submitted ? SUBMITTED_NOTICE : NOT_APPLIED_NOTICE;

  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="whitespace-pre-wrap">{notice}</AlertDescription>
    </Alert>
  );
}
