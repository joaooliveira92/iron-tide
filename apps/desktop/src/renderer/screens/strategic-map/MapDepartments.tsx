import type { StrategicMapView } from "@bluewave/campaign-engine";
import { BluewaveError } from "@bluewave/contracts";
import { Eye, Flag, MapPinned, Route, ShieldBan, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { IndexTab } from "../../components/slate/IndexTabs.js";
import { Leader, LedgerRow } from "../../components/slate/Slate.js";
import type { CampaignAreaEntry } from "../../components/world-map/campaign-map-join.js";
import type { MapOrderFleet, MapPendingOrder } from "../../components/world-map/map-orders.js";
import { campaignNationLabel } from "../../content/presentationContent.js";
import { translate } from "../../lib/strings.js";

export type MapDepartment = "orders" | "blockades" | "stations" | "areas" | "intel";

export interface StationShortfall {
  readonly areaId: string;
  readonly areaName: string;
  readonly required: number;
  readonly present: number;
  readonly shortfall: number;
}

export interface MapDepartmentData {
  readonly fleets: readonly MapOrderFleet[];
  readonly pending: readonly MapPendingOrder[];
  readonly strategic: StrategicMapView | null;
  readonly shortfalls: readonly StationShortfall[] | null;
  readonly campaignAreas: readonly CampaignAreaEntry[];
  readonly areaName: (areaId: string) => string;
  readonly onCancelOrder: (commandId: string) => void;
}

interface DepartmentMeta {
  readonly id: MapDepartment;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly summary: string;
}

const META: readonly (readonly DepartmentMeta[])[] = [
  [
    {
      id: "orders",
      icon: Route,
      label: translate("map.desk.orders.label"),
      summary: translate("map.desk.orders.summary"),
    },
    {
      id: "blockades",
      icon: ShieldBan,
      label: translate("map.desk.blockades.label"),
      summary: translate("map.desk.blockades.summary"),
    },
  ],
  [
    {
      id: "stations",
      icon: Flag,
      label: translate("map.desk.stations.label"),
      summary: translate("map.desk.stations.summary"),
    },
    {
      id: "areas",
      icon: MapPinned,
      label: translate("map.desk.areas.label"),
      summary: translate("map.desk.areas.summary"),
    },
  ],
  [
    {
      id: "intel",
      icon: Eye,
      label: translate("map.desk.intel.label"),
      summary: translate("map.desk.intel.summary"),
    },
  ],
];

export function mapDepartmentMeta(id: MapDepartment): DepartmentMeta {
  const found = META.flat().find((meta) => meta.id === id);
  if (found === undefined) throw new BluewaveError("MAP_DEPARTMENT_UNKNOWN", { id });
  return found;
}

function detailFor(
  id: MapDepartment,
  data: MapDepartmentData,
): { text: string; attention: boolean } {
  switch (id) {
    case "orders":
      return data.pending.length === 0
        ? { text: translate("map.desk.orders.none"), attention: false }
        : {
            text: translate("map.desk.orders.count", { count: String(data.pending.length) }),
            attention: true,
          };
    case "blockades": {
      const count = data.strategic?.blockades.length ?? 0;
      return count === 0
        ? { text: translate("map.desk.blockades.none"), attention: false }
        : {
            text: translate("map.desk.blockades.count", { count: String(count) }),
            attention: true,
          };
    }
    case "stations": {
      if (data.shortfalls === null) {
        return { text: translate("map.desk.stations.unconfigured"), attention: false };
      }
      return data.shortfalls.length === 0
        ? { text: translate("map.desk.stations.covered"), attention: false }
        : {
            text: translate("map.desk.stations.short", { count: String(data.shortfalls.length) }),
            attention: true,
          };
    }
    case "areas":
      return {
        text: translate("map.desk.areas.count", { count: String(data.campaignAreas.length) }),
        attention: false,
      };
    case "intel":
      return { text: translate("map.desk.intel.detail"), attention: false };
  }
}

export function mapIndexTabs(
  data: MapDepartmentData,
): readonly (readonly IndexTab<MapDepartment>[])[] {
  return META.map((group) =>
    group.map((meta) => {
      const detail = detailFor(meta.id, data);
      return {
        id: meta.id,
        label: meta.label,
        icon: meta.icon,
        detail: detail.text,
        attention: detail.attention,
      };
    }),
  );
}

function Rows({ children }: { readonly children: ReactNode }) {
  return <ul className="m-0 list-none divide-y divide-admiralty-border p-0">{children}</ul>;
}

function Empty({ children }: { readonly children: ReactNode }) {
  return <p className="text-admiralty-ink-muted">{children}</p>;
}

function OrdersList({ data }: { readonly data: MapDepartmentData }) {
  if (data.pending.length === 0) return <Empty>{translate("map.desk.orders.empty")}</Empty>;
  return (
    <Rows>
      {data.pending.map((order) => {
        const fleet = data.fleets.find((candidate) => candidate.fleetId === order.fleetId);
        return (
          <li key={order.commandId} className="space-y-1 py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-base font-semibold">
                {fleet?.fleetName ?? order.fleetId}
              </span>
              <Leader />
              <span className="font-display">{order.destinationName}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-admiralty-ink-muted">
              <span>
                {translate("map.orders.from", { area: fleet?.areaName ?? order.fromMapAreaId })}
              </span>
              <button
                type="button"
                onClick={() => data.onCancelOrder(order.commandId)}
                className="underline underline-offset-2 hover:text-admiralty-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal"
              >
                {translate("map.orders.cancel")}
              </button>
            </div>
          </li>
        );
      })}
    </Rows>
  );
}

function BlockadeList({ data }: { readonly data: MapDepartmentData }) {
  const blockades = data.strategic?.blockades ?? [];
  if (blockades.length === 0) return <Empty>{translate("map.blockade.none")}</Empty>;
  return (
    <Rows>
      {blockades.map((blockade) => (
        <li
          key={`${blockade.areaId}:${blockade.blockaderId}:${blockade.blockadedNationId}`}
          className="space-y-1 py-3"
        >
          <p className="font-display text-base font-semibold">
            {translate("map.blockade.row", {
              blockader: campaignNationLabel(blockade.blockaderId),
              blockaded: campaignNationLabel(blockade.blockadedNationId),
              area: data.areaName(blockade.areaId),
            })}
          </p>
          <p className="text-admiralty-ink-muted">
            {translate("map.desk.blockades.since", { month: blockade.establishedMonth })}
          </p>
        </li>
      ))}
    </Rows>
  );
}

function StationLedger({ data }: { readonly data: MapDepartmentData }) {
  if (data.shortfalls === null) return <Empty>{translate("map.presence.unconfigured")}</Empty>;
  if (data.shortfalls.length === 0) return <Empty>{translate("map.presence.none")}</Empty>;
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {data.shortfalls.map((row) => (
        <li key={row.areaId}>
          <dl className="m-0">
            <LedgerRow
              label={row.areaName}
              value={translate("map.desk.stations.shortfall", { tons: String(row.shortfall) })}
              emphasis
            />
          </dl>
          <p className="text-admiralty-ink-muted">
            {translate("map.desk.stations.detail", {
              required: String(row.required),
              present: String(row.present),
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AreaLedger({ data }: { readonly data: MapDepartmentData }) {
  if (data.campaignAreas.length === 0) return <Empty>{translate("map.desk.areas.empty")}</Empty>;
  return (
    <Rows>
      {data.campaignAreas.map((area) => (
        <li key={area.id} className="py-2.5">
          <dl className="m-0">
            <LedgerRow
              label={area.name}
              value={
                area.controller === null
                  ? translate("map.desk.areas.unclaimed")
                  : campaignNationLabel(area.controller)
              }
            />
          </dl>
          <p className="text-admiralty-ink-muted">
            {area.fleets.length === 0
              ? translate("map.desk.areas.noFleets")
              : area.fleets
                  .map((fleet) => `${campaignNationLabel(fleet.nation)} ${fleet.ships}`)
                  .join(", ")}
          </p>
        </li>
      ))}
    </Rows>
  );
}

export function MapDepartmentBody({
  id,
  data,
}: {
  readonly id: MapDepartment;
  readonly data: MapDepartmentData;
}) {
  switch (id) {
    case "orders":
      return <OrdersList data={data} />;
    case "blockades":
      return <BlockadeList data={data} />;
    case "stations":
      return <StationLedger data={data} />;
    case "areas":
      return <AreaLedger data={data} />;
    case "intel":
      return <Empty>{translate("map.legend.notModelled")}</Empty>;
  }
}
