import { History } from "lucide-react";
import { useBridge } from "../../lib/bridge-context.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Button } from "../../components/ui/button.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { campaignDateLabel } from "./campaign-list-screen-state.js";
import { useCampaignList } from "./useCampaignList.js";

export function CampaignListScreen() {
  const { state } = useCampaignList();
  const bridge = useBridge();

  const { saves, loadError } = state;

  if (loadError !== null) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to list campaigns: {loadError}
      </div>
    );
  }

  if (saves === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((idx) => (
          <Skeleton key={idx} className="h-10" />
        ))}
      </div>
    );
  }

  const loadSave = async () => {
    if (bridge === undefined) return;
    await bridge.campaign.execute("loadCampaign", undefined);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={History}
        title="Campaigns"
        description="Saved campaigns in the selected package."
      />

      {saves.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved campaigns found in this package.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign name</TableHead>
              <TableHead>Nation</TableHead>
              <TableHead>Current date</TableHead>
              <TableHead>Last saved</TableHead>
              <TableHead>Save-format version</TableHead>
              <TableHead>Campaign status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {saves.map((save) => (
              <TableRow key={save.saveId}>
                <TableCell>{save.campaignName ?? "—"}</TableCell>
                <TableCell>{save.nationId ?? "—"}</TableCell>
                <TableCell>{campaignDateLabel(save)}</TableCell>
                <TableCell>{save.timestamp || "—"}</TableCell>
                <TableCell>{save.compatibilityVersion || "—"}</TableCell>
                <TableCell>—</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => void loadSave()}>
                    Load
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
