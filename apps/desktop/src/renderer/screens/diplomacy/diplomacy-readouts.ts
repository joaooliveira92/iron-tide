import type { EngineeringReadout, ReadoutTone } from "../shipbuilding/engineering-status.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { warScoreSplit } from "./diplomacy-presentation.js";
import type { DiplomacyRelationRow, DiplomacyViewModel } from "./diplomacy-view-model.js";

const BRINK_BREAKDOWN_ROWS = 5;

function brinkTone(tension: number): ReadoutTone {
  if (tension >= 8) return "bad";
  if (tension >= 6) return "warn";
  return "neutral";
}

function namesHint(title: string, rows: readonly DiplomacyRelationRow[]) {
  return rows.length === 0
    ? undefined
    : { title, lines: rows.map((row) => ({ label: row.partnerName, value: row.relationLabel })) };
}

export function foreignReadouts(vm: DiplomacyViewModel): EngineeringReadout[] {
  const { posture } = vm;
  const atWar = posture.activeWars > 0;
  const tense = posture.mostTense;
  const allies = vm.relations.filter((row) => row.allied);
  const pacts = vm.relations.filter((row) => row.nap);
  const activeWars = vm.wars.filter((row) => row.war.status === "ACTIVE");
  const allyHint = namesHint("Allied nations", allies);
  const pactHint = namesHint("Non-aggression pacts", pacts);
  return [
    {
      id: "standing",
      label: "Standing",
      value: atWar ? "At war" : "At peace",
      tone: atWar ? "bad" : "neutral",
    },
    {
      id: "wars",
      label: "Wars",
      value: String(posture.activeWars),
      tone: atWar ? "bad" : "neutral",
      ...(activeWars.length === 0
        ? {}
        : {
            breakdown: {
              title: "Active wars, your score first",
              rows: activeWars.map((row) => {
                const split = warScoreSplit(row.war);
                return { label: row.enemyName, value: `${split.yours} : ${split.enemy}` };
              }),
              causes: [],
            },
          }),
    },
    {
      id: "allies",
      label: "Allies",
      value: String(posture.allies),
      tone: "neutral",
      ...(allyHint === undefined ? {} : { hint: allyHint }),
    },
    {
      id: "pacts",
      label: "Pacts",
      value: String(posture.pacts),
      tone: "neutral",
      ...(pactHint === undefined ? {} : { hint: pactHint }),
    },
    { id: "blockades", label: "Blockades", value: String(posture.blockades), tone: "neutral" },
    {
      id: "brink",
      label: "Closest to war",
      value: tense === null ? "none" : `${tense.partnerName} ${tense.tension}/10`,
      tone: tense === null ? "neutral" : brinkTone(tense.tension),
      ...(vm.relations.length === 0
        ? {}
        : {
            breakdown: {
              title: "Most tense relations",
              rows: vm.relations.slice(0, BRINK_BREAKDOWN_ROWS).map((row) => ({
                label: row.partnerName,
                value: `${row.tension}/10 ${humanizeId(row.band).toLowerCase()}`,
              })),
              causes: [],
            },
          }),
    },
    {
      id: "order",
      label: "Order",
      value: vm.draftLabel ?? "none queued",
      tone: "neutral",
    },
  ];
}
