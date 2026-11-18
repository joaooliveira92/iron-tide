import { Card, CardContent } from "../../../components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import { translate } from "../../../lib/strings.js";
import { format, type StationRow } from "./fleet-station-state.js";

export interface StationShipTableProps {
  readonly rows: readonly StationRow[];
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (shipId: string) => void;
}

function StatusCell({ row }: { readonly row: StationRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <abbr title={row.statusLabel} className="font-mono no-underline">
        {row.statusCode}
        {row.overBase ? <span aria-hidden="true">*</span> : null}
      </abbr>
      <span className="text-xs text-muted-foreground">{row.statusLabel}</span>
      {row.overBase ? (
        <span className="text-xs font-medium text-foreground">{row.overBaseLabel}</span>
      ) : null}
      {row.conditions.map((condition) => (
        <span key={condition.code} className="text-xs font-medium text-foreground">
          {condition.label}
        </span>
      ))}
    </span>
  );
}

function FlagCell({ row, code }: { readonly row: StationRow; readonly code: "c" | "a" | "S" }) {
  const flag = row.flags.find((candidate) => candidate.code === code);
  return flag ? (
    <abbr title={flag.label} className="font-mono no-underline">
      {flag.code}
      <span className="sr-only"> {flag.label}</span>
    </abbr>
  ) : (
    <span className="text-muted-foreground">
      <span aria-hidden="true">-</span>
      <span className="sr-only">{translate("fleet.flag.none")}</span>
    </span>
  );
}

export function StationShipTable({ rows, selectedIds, onToggle }: StationShipTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{translate("fleet.station.col.select")}</TableHead>
              <TableHead>{translate("fleet.station.col.ship")}</TableHead>
              <TableHead>{translate("fleet.station.col.area")}</TableHead>
              <TableHead>{translate("fleet.station.col.status")}</TableHead>
              <TableHead>
                <abbr title={translate("fleet.station.col.colonial.label")}>
                  {translate("fleet.station.col.colonial")}
                </abbr>
              </TableHead>
              <TableHead>
                <abbr title={translate("fleet.station.col.cramped.label")}>
                  {translate("fleet.station.col.cramped")}
                </abbr>
              </TableHead>
              <TableHead>
                <abbr title={translate("fleet.station.col.range.label")}>
                  {translate("fleet.station.col.range")}
                </abbr>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.shipId} data-testid={`fleet-station-row-${row.shipId}`}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedIds.has(row.shipId)}
                    onChange={() => onToggle(row.shipId)}
                    aria-label={format("fleet.station.selectShip", {
                      ship: row.name,
                    })}
                  />
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.areaName}</TableCell>
                <TableCell>
                  <StatusCell row={row} />
                </TableCell>
                <TableCell>
                  <FlagCell row={row} code="c" />
                </TableCell>
                <TableCell>
                  <FlagCell row={row} code="a" />
                </TableCell>
                <TableCell>
                  <FlagCell row={row} code="S" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
