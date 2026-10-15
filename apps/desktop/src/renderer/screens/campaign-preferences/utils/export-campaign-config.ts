import type { PlayerProjection } from "@bluewave/campaign-engine";

export function downloadCampaignConfig(sessionId: string, projection: PlayerProjection): void {
  const data = JSON.stringify(
    {
      sessionId,
      campaignIdentity: projection.campaignIdentity,
      revision: projection.revision,
      month: projection.month,
      snapshotHash: projection.snapshotHash,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-${projection.campaignIdentity.slice(0, 8)}-config.json`;
  a.click();
  URL.revokeObjectURL(url);
}
