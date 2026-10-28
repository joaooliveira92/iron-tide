import { Map as MapIcon } from "lucide-react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { Button } from "../../components/ui/button.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { MapSurface } from "../../components/globe-adapter/MapSurface.js";
import { campaignNationLabel } from "../../content/presentationContent.js";
import { translate } from "../../lib/strings.js";
import { OrdersPanel, type BlockadeRow } from "./OrdersPanel.js";
import { useStrategicMapScreen } from "./useStrategicMapScreen.js";

export interface StrategicMapScreenProps {
  readonly sessionId: string;
}

export function StrategicMapScreen({ sessionId }: StrategicMapScreenProps) {
  const map = useStrategicMapScreen(sessionId);

  const areaName = (areaId: string): string =>
    map.map.overlay.campaignAreas?.find((area) => area.id === areaId)?.name ?? areaId;

  const blockades: readonly BlockadeRow[] = (map.strategic?.blockades ?? []).map((blockade) => ({
    key: `${blockade.areaId}:${blockade.blockaderId}:${blockade.blockadedNationId}`,
    text: translate("map.blockade.row", {
      blockader: campaignNationLabel(blockade.blockaderId),
      blockaded: campaignNationLabel(blockade.blockadedNationId),
      area: areaName(blockade.areaId),
    }),
  }));

  return (
    <ScreenStage
      guidedTarget="strategic-map"
      icon={MapIcon}
      title={translate("map.title")}
      description={translate("map.description")}
      className="flex h-full min-h-0 flex-col gap-3"
    >
      {map.loadError !== null ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-destructive/60 p-3 text-sm"
        >
          <p className="whitespace-pre-line">{map.loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={map.retry}>
            {translate("map.retry")}
          </Button>
        </div>
      ) : map.loading ? (
        <div className="flex min-h-0 flex-1 gap-3" aria-busy="true">
          <Skeleton className="min-h-[28rem] flex-1 rounded-lg" />
          <Skeleton className="hidden w-[22rem] rounded-lg lg:block" />
        </div>
      ) : (
        <div
          data-testid="strategic-map-workspace"
          className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]"
        >
          <div className="h-[calc(100vh-16rem)] min-h-[28rem] overflow-hidden rounded-lg border bg-background">
            <MapSurface
              className="h-full"
              variant="full"
              {...map.map}
              orders={map.orders}
              treeDefaultOpen={false}
            />
          </div>
          <OrdersPanel
            className="h-[calc(100vh-16rem)] min-h-[28rem]"
            fleets={map.orders.fleets}
            pending={map.orders.pending}
            selectedFleet={map.selectedFleet}
            choices={map.choices}
            notice={map.notice}
            noticeKind={map.noticeKind}
            presence={map.presence}
            areaName={areaName}
            blockades={blockades}
            onSelectFleet={map.selectFleet}
            onOrder={map.orderTo}
            onChoose={map.chooseDestination}
            onCancelChoice={map.cancelChoice}
            onCancelOrder={map.cancelOrder}
          />
        </div>
      )}
    </ScreenStage>
  );
}
