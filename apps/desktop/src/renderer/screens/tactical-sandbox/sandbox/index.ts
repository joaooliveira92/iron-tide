import {
  SandboxBody,
  SandboxEventLedger,
  SandboxOutcomeCard,
  SandboxResolveCard,
  SandboxSetupCard,
} from "./components/index.js";
import { SandboxProvider } from "./SandboxProvider.js";
import { useSandbox, type SandboxContextValue } from "./sandbox-context.js";

export const Sandbox = {
  Provider: SandboxProvider,
  Body: SandboxBody,
  SetupCard: SandboxSetupCard,
  ResolveCard: SandboxResolveCard,
  OutcomeCard: SandboxOutcomeCard,
  EventLedger: SandboxEventLedger,
};

export { SandboxProvider, useSandbox };
export type { SandboxContextValue };
