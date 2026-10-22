import type { CampaignCommandName } from "../../shared/campaign-command-descriptors.js";
import { commandHandlers } from "../campaignBridge.js";
import {
  runCommandHandler,
  type CommandBodyEffect,
  type CommandProgram,
} from "./commandProgram.js";

export type AnyCommandHandler = (payload: never) => CommandBodyEffect;

export function programFor(handler: AnyCommandHandler): CommandProgram {
  const entry = (
    Object.entries(commandHandlers) as [CampaignCommandName, AnyCommandHandler][]
  ).find(([, registered]) => registered === handler);
  if (entry === undefined) {
    throw new Error("handler is not registered in commandHandlers");
  }
  return (payload) => runCommandHandler(entry[0], handler, payload);
}
