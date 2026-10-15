import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { AuditRecord } from "./types.js";

export class AuditChain {
  private records: AuditRecord[] = [];
  private lastHash = "0".repeat(64);

  append(
    campaignId: string,
    commandId: string,
    phaseId: string,
    actorId: string,
    inputHash: string,
    outputHash: string,
    policyVersion: string,
    handlerVersion: string,
    reasonCodes: string[],
  ): AuditRecord {
    const rec: AuditRecord = {
      previousAuditHash: this.lastHash,
      currentRecordHash: "",
      campaignId,
      commandId,
      phaseId,
      actorId,
      inputHash,
      outputHash,
      policyVersion,
      handlerVersion,
      reasonCodes,
    };
    const hash = sha256Hex(canonicalSerialize(rec));
    const final = { ...rec, currentRecordHash: hash };
    this.records.push(final);
    this.lastHash = hash;
    return final;
  }

  get all(): readonly AuditRecord[] {
    return this.records;
  }
  get headHash(): string {
    return this.lastHash;
  }
  ledgerHash(): string {
    return sha256Hex(canonicalSerialize(this.records));
  }
}
