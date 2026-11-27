import type {
  MonthlyReportNeutralWar,
  MonthlyReportRaiderEntry,
  MonthlyReportTradeProtection,
  MonthlyReportWarshipAttackEntry,
} from "../../../../shared/reports-contract.js";
import { campaignNationLabel } from "../../../content/presentationContent.js";
import { translate } from "../../../lib/strings.js";
import { percentOfBp } from "../../fleet/trade/trade-model.js";
import { SummaryList, SummaryRow, SummarySection } from "./summary/index.js";

function standingLine(trade: MonthlyReportTradeProtection): string {
  if (trade.quota === 0) return translate("reports.trade.noQuota");
  const standing =
    trade.shortfall === 0
      ? translate("reports.trade.met")
      : translate("reports.trade.short", {
          shortfall: trade.shortfall,
          percent: percentOfBp(trade.shortfallBp),
        });
  return translate("reports.trade.quota", {
    quota: trade.quota,
    assigned: trade.assigned,
    standing,
  });
}

function lossLine(loss: NonNullable<MonthlyReportTradeProtection["loss"]>): string {
  const causes: string[] = [];
  if (loss.raiderHits > 0) {
    causes.push(
      translate(
        loss.raiderHits === 1
          ? "reports.trade.loss.raiderHits.one"
          : "reports.trade.loss.raiderHits.many",
        { n: loss.raiderHits },
      ),
    );
  }
  const submarineHits = loss.submarineHits ?? 0;
  if (submarineHits > 0) {
    causes.push(
      translate(
        submarineHits === 1
          ? "reports.trade.loss.submarineHits.one"
          : "reports.trade.loss.submarineHits.many",
        { n: submarineHits },
      ),
    );
  }
  if (loss.pressureHit) causes.push(translate("reports.trade.loss.pressure"));
  if (causes.length === 0) causes.push(translate("reports.trade.loss.unattributed"));
  const before = percentOfBp(loss.poolBefore);
  const after = percentOfBp(loss.poolAfter);
  return translate("reports.trade.loss", {
    before,
    after,
    delta: after - before,
    causes: causes.join(", "),
  });
}

function raiderLine(entry: MonthlyReportRaiderEntry): string {
  const ship = entry.shipName ?? entry.shipId;
  if (entry.event === "RELEASED") return translate("reports.trade.raider.released", { ship });
  if (entry.event === "INTERNED") {
    return translate(`reports.trade.raider.interned.${entry.cause ?? "NONE"}`, { ship });
  }
  return translate(
    `reports.trade.raider.engaged.${entry.encounter ?? "NONE"}.${entry.outcome ?? "NONE"}`,
    { ship, nation: campaignNationLabel(entry.victimNationId ?? "") },
  );
}

function warshipAttackLine(entry: MonthlyReportWarshipAttackEntry): string {
  const ship = entry.victimShipName ?? entry.victimShipId;
  const nation = campaignNationLabel(entry.nationId);
  if (entry.outcome === "SUNK") {
    return translate("reports.trade.warshipAttack.SUNK", { nation, ship });
  }
  return translate("reports.trade.warshipAttack.DAMAGED", {
    nation,
    ship,
    percent: percentOfBp(entry.damageBp),
  });
}

function neutralWarLine(war: MonthlyReportNeutralWar): string {
  return translate(`reports.trade.neutralWar.${war.role}`, {
    nation: campaignNationLabel(war.otherNationId),
    tension: war.tension,
  });
}

export function MonthReportTradeSection({
  trade,
  neutralWars = [],
}: {
  readonly trade?: MonthlyReportTradeProtection;
  readonly neutralWars?: readonly MonthlyReportNeutralWar[];
}) {
  const raiders = trade?.raiders ?? [];
  const warshipAttacks = trade?.warshipAttacks ?? [];
  return (
    <SummarySection
      variant="report"
      ariaLabel={translate("reports.trade.title")}
      className="space-y-1"
      title={translate("reports.trade.title")}
    >
      <SummaryList variant="report" ariaLabel={translate("reports.trade.title")}>
        {trade === undefined ? null : (
          <SummaryRow variant="report">{standingLine(trade)}</SummaryRow>
        )}
        {trade?.loss === undefined ? null : (
          <li className="text-destructive" data-testid="month-report-trade-loss">
            {lossLine(trade.loss)}
          </li>
        )}
        {raiders.map((entry, index) => (
          <li key={`${entry.shipId}-${entry.event}-${index}`} data-testid="month-report-raider">
            {raiderLine(entry)}
          </li>
        ))}
        {warshipAttacks.map((entry, index) => (
          <li
            key={`${entry.boatId}-${entry.victimShipId}-${index}`}
            className="text-destructive"
            data-testid="month-report-warship-attack"
          >
            {warshipAttackLine(entry)}
          </li>
        ))}
        {neutralWars.map((war) => (
          <li key={war.warId} className="text-destructive" data-testid="month-report-neutral-war">
            {neutralWarLine(war)}
          </li>
        ))}
      </SummaryList>
    </SummarySection>
  );
}
