import { Handshake } from "lucide-react";
import {
  ScreenLoadErrorState,
  ScreenLoadingState,
  type ScreenLoadStateProps,
} from "../../../components/shared/ScreenLoadStates.js";

const DIPLOMACY_HEADER: Omit<ScreenLoadStateProps, "guidedTarget"> = {
  icon: Handshake,
  title: "Diplomacy & War",
  description: "Relations, wars and blockades from the compiled campaign state.",
};

const DIPLOMACY_GUIDED_TARGET = "diplomacy";

export interface DiplomacyLoadErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

export function DiplomacyLoadErrorState({ message, onRetry }: DiplomacyLoadErrorStateProps) {
  return (
    <ScreenLoadErrorState
      guidedTarget={DIPLOMACY_GUIDED_TARGET}
      {...DIPLOMACY_HEADER}
      errorTitle="Diplomacy screen failed to load"
      message={message}
      onRetry={onRetry}
    />
  );
}

export function DiplomacyLoadingState() {
  return <ScreenLoadingState guidedTarget={DIPLOMACY_GUIDED_TARGET} {...DIPLOMACY_HEADER} />;
}
