import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Map as MapIcon } from "lucide-react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { ChartDesk, INDEX_TABS_CLEARANCE } from "../../components/slate/ChartDesk.js";
import { DepartmentDrawer } from "../../components/slate/DepartmentDrawer.js";
import { IndexTabs } from "../../components/slate/IndexTabs.js";
import { Button } from "../../components/ui/button.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { MapSurface } from "../../components/globe-adapter/MapSurface.js";
import type { CampaignAreaEntry } from "../../components/world-map/campaign-map-join.js";
import { nationHomeArea } from "../../content/presentationContent.js";
import { translate } from "../../lib/strings.js";
import { useMinWidth } from "../../lib/use-min-width.js";
import { COMMAND_OVERLAY_MIN_WIDTH } from "../overview/hooks/useOverviewModel.js";
import { MapDispatch } from "./MapDispatch.js";
import {
  MapDepartmentBody,
  mapDepartmentMeta,
  mapIndexTabs,
  type MapDepartment,
  type MapDepartmentData,
  type StationShortfall,
} from "./MapDepartments.js";
import { useStrategicMapScreen } from "./useStrategicMapScreen.js";

export interface StrategicMapScreenProps {
  readonly sessionId: string;
}

const DRAWER_WIDTH = "28rem";

const NO_AREAS: readonly CampaignAreaEntry[] = [];

export function StrategicMapScreen({ sessionId }: StrategicMapScreenProps) {
  const {
    map: mapController,
    strategic,
    presence,
    orders,
    selectedFleet,
    choices,
    notice,
    noticeKind,
    loadError,
    loading,
    selectFleet,
    orderTo,
    chooseDestination,
    cancelChoice,
    cancelOrder,
    retry,
  } = useStrategicMapScreen(sessionId);
  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const [department, setDepartment] = useState<MapDepartment | null>(null);

  const campaignAreas = mapController.overlay.campaignAreas ?? NO_AREAS;
  const areaNameMap = useMemo(
    () => new Map(campaignAreas.map((area) => [area.id, area.name])),
    [campaignAreas],
  );
  const areaName = useCallback(
    (areaId: string) => areaNameMap.get(areaId) ?? areaId,
    [areaNameMap],
  );

  const shortfalls = useMemo<readonly StationShortfall[] | null>(() => {
    if (presence === null || !presence.configured) return null;
    return presence.areas
      .filter((area) => area.shortfallTons > 0)
      .map((area) => ({
        areaId: area.areaId,
        areaName: areaName(area.areaId),
        required: area.requiredTons,
        present: area.presentTons,
        shortfall: area.shortfallTons,
      }));
  }, [presence, areaName]);

  if (loadError !== null) {
    return (
      <ScreenStage
        guidedTarget="strategic-map"
        icon={MapIcon}
        title={translate("map.title")}
        description={translate("map.description")}
        className="flex h-full min-h-0 flex-col gap-3"
      >
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-destructive/60 p-3 text-sm"
        >
          <p className="whitespace-pre-line">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            {translate("map.retry")}
          </Button>
        </div>
      </ScreenStage>
    );
  }

  if (loading) {
    return (
      <ScreenStage
        guidedTarget="strategic-map"
        icon={MapIcon}
        title={translate("map.title")}
        description={translate("map.description")}
        className="flex h-full min-h-0 flex-col gap-3"
      >
        <div className="flex min-h-0 flex-1 gap-3" aria-busy="true">
          <Skeleton className="min-h-[28rem] flex-1 rounded-lg" />
          <Skeleton className="hidden w-[22rem] rounded-lg lg:block" />
        </div>
      </ScreenStage>
    );
  }

  const data: MapDepartmentData = {
    fleets: orders.fleets,
    pending: orders.pending,
    strategic,
    shortfalls,
    campaignAreas,
    areaName,
    onCancelOrder: cancelOrder,
  };

  const dispatch = (
    <MapDispatch
      fleets={orders.fleets}
      pending={orders.pending}
      selectedFleet={selectedFleet}
      choices={choices}
      notice={notice}
      noticeKind={noticeKind}
      onSelectFleet={selectFleet}
      onOrder={orderTo}
      onChoose={chooseDestination}
      onCancelChoice={cancelChoice}
      onCancelOrder={cancelOrder}
    />
  );

  const tabs = (
    <IndexTabs
      label={translate("map.desk.tabs")}
      testId="strategic-affairs"
      groups={mapIndexTabs(data)}
      openId={department}
      onOpen={(id) => setDepartment(department === id ? null : id)}
      attached={wide}
    />
  );

  const drawer =
    department === null ? null : (
      <DepartmentDrawer
        title={mapDepartmentMeta(department).label}
        summary={mapDepartmentMeta(department).summary}
        width="narrow"
        testId="strategic-department"
        onClose={() => setDepartment(null)}
      >
        <MapDepartmentBody id={department} data={data} />
      </DepartmentDrawer>
    );

  const surface = (variant: "command" | "panel") => (
    <MapSurface
      enableGlobe
      className="h-full"
      variant={variant}
      {...mapController}
      initialFocusAreaId={nationHomeArea(mapController.overlay.playerNationId)}
      initialFocusNationId={mapController.overlay.playerNationId}
      orders={orders}
      showMinimap={false}
      treeDefaultOpen={false}
    />
  );

  if (wide) {
    const clearance =
      department === null
        ? INDEX_TABS_CLEARANCE
        : `calc(${INDEX_TABS_CLEARANCE} + ${DRAWER_WIDTH} + 0.75rem)`;
    return (
      <div
        data-testid="strategic-map-workspace"
        data-guided-target="strategic-map"
        className="relative h-full min-h-[28rem]"
        style={{ "--chrome-right": clearance } as CSSProperties}
      >
        <h2 className="sr-only">{translate("map.title")}</h2>
        {surface("command")}
        <ChartDesk tabs={tabs} drawer={drawer} slip={dispatch} />
      </div>
    );
  }

  return (
    <ScreenStage
      guidedTarget="strategic-map"
      icon={MapIcon}
      title={translate("map.title")}
      description={translate("map.description")}
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <div data-testid="strategic-map-workspace" className="h-[60vh] min-h-[22rem]">
        {surface("panel")}
      </div>
      <div className="flex flex-col gap-3">
        {dispatch}
        {tabs}
        {drawer !== null && <div className="h-[70vh] min-h-[22rem]">{drawer}</div>}
      </div>
    </ScreenStage>
  );
}
