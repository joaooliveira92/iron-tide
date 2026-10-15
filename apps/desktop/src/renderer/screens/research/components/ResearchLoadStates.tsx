import { FlaskConical } from "lucide-react";
import {
  ScreenLoadErrorState,
  ScreenLoadingState,
  type ScreenLoadStateProps,
} from "../../../components/shared/ScreenLoadStates.js";

const RESEARCH_HEADER: Omit<ScreenLoadStateProps, "guidedTarget"> = {
  icon: FlaskConical,
  title: "Research & Technology",
  description: "Direct the monthly research budget across fields.",
};

const RESEARCH_GUIDED_TARGET = "research";

export interface ResearchLoadErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

export function ResearchLoadErrorState({ message, onRetry }: ResearchLoadErrorStateProps) {
  return (
    <ScreenLoadErrorState
      guidedTarget={RESEARCH_GUIDED_TARGET}
      {...RESEARCH_HEADER}
      errorTitle="Research screen failed to load"
      message={message}
      onRetry={onRetry}
    />
  );
}

export function ResearchLoadingState() {
  return <ScreenLoadingState guidedTarget={RESEARCH_GUIDED_TARGET} {...RESEARCH_HEADER} />;
}
