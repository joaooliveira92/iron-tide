import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
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
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { PresenceReadoutView } from "./fleet-station-state.js";

export function PresenceReadout({ readout }: { readonly readout: PresenceReadoutView }) {
  const format = usePresentationFormat();
  return (
    <section className="space-y-3" data-testid="fleet-presence" aria-labelledby="fleet-presence-h">
      <h4 id="fleet-presence-h" className="text-sm font-medium">
        {translate("fleet.presence.title")}
      </h4>
      {readout.kind === "not-configured" ? (
        <p className="text-sm text-muted-foreground" data-testid="fleet-presence-not-configured">
          {translate("fleet.presence.notConfigured")}
        </p>
      ) : (
        <>
          {readout.exempt ? (
            <p
              role="status"
              className="rounded-md border px-3 py-2 text-sm"
              data-testid="fleet-presence-exempt"
            >
              {translate("fleet.presence.exempt")}
            </p>
          ) : null}
          {readout.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{translate("fleet.presence.noAreas")}</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate("fleet.presence.col.area")}</TableHead>
                      <TableHead>{translate("fleet.presence.col.required")}</TableHead>
                      <TableHead>{translate("fleet.presence.col.present")}</TableHead>
                      <TableHead>{translate("fleet.presence.col.shortfall")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readout.rows.map((row) => (
                      <TableRow key={row.areaId}>
                        <TableCell className="font-medium">{row.areaName}</TableCell>
                        <TableCell>{row.required}</TableCell>
                        <TableCell>{row.present}</TableCell>
                        <TableCell className={row.short ? "font-medium" : "text-muted-foreground"}>
                          {row.shortfall}
                          {row.shortfallExplanation !== undefined && (
                            <ExplanationDisclosure
                              tree={row.shortfallExplanation}
                              area="fleet"
                              summaryKey="fleet.fleet_presence.summary"
                              format={format}
                              testId={`fleet-presence-explanation-${row.areaId}`}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <div data-testid="fleet-over-base">
        <h5 className="text-sm font-medium">{translate("fleet.overBase.title")}</h5>
        {readout.overBase.length === 0 ? (
          <p className="text-sm text-muted-foreground">{translate("fleet.overBase.none")}</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {readout.overBase.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
