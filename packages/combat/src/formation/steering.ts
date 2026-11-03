import type {
  FormationDivisionView,
  FormationKeepingRuleset,
  FormationShipView,
  FormationTrack,
  ShipOrderOverride,
  ShipStationRecord,
  StationKeepingMode,
  StationPoint,
} from "./contracts.js";
import { alongHeadingUm, bearingDeg, distanceM, stationPoint } from "./geometry.js";
import { pointAtPathDistance } from "./track.js";

export interface DivisionSteeringInput {
  division: FormationDivisionView;
  ships: Readonly<Record<string, FormationShipView>>;
  ruleset: FormationKeepingRuleset;
  turnTogether: boolean;
  track: FormationTrack | undefined;
}

export interface DivisionSteeringPlan {
  overrides: Record<string, ShipOrderOverride>;
  records: ShipStationRecord[];
  divisionSpeedBp: number;
}

const UM_PER_M = 1_000_000;

export function divisionSpeedBp(
  division: FormationDivisionView,
  ships: Readonly<Record<string, FormationShipView>>,
): number {
  const flagship = ships[division.flagshipId]!;
  let speed = flagship.orderedSpeedBp;
  for (const id of division.memberIds) {
    speed = Math.min(speed, ships[id]!.attainableMaxBp);
  }
  return speed;
}

function catchUpSpeedBp(
  speedBp: number,
  attainableMaxBp: number,
  errorUm: number,
  ruleset: FormationKeepingRuleset,
): number {
  const ratioBp = Math.max(
    -10_000,
    Math.min(10_000, Math.trunc((errorUm * 10_000) / ruleset.catchUpFullErrorUm)),
  );
  const adjustment = Math.trunc((speedBp * ruleset.catchUpMarginBp * ratioBp) / 100_000_000);
  return Math.max(0, Math.min(attainableMaxBp, speedBp + adjustment));
}

export function planDivisionSteering(input: DivisionSteeringInput): DivisionSteeringPlan {
  const { division, ships, ruleset, turnTogether, track } = input;
  const flagship = ships[division.flagshipId]!;
  const speedBp = divisionSpeedBp(division, ships);
  const overrides: Record<string, ShipOrderOverride> = {
    [division.flagshipId]: { orderedHeading: flagship.orderedHeading, orderedSpeedBp: speedBp },
  };
  const records: ShipStationRecord[] = [
    {
      assetId: division.flagshipId,
      divisionId: division.divisionId,
      formation: division.formation,
      mode: "FLAGSHIP",
      offStation: false,
      stationErrorM: 0,
      divisionSpeedBp: speedBp,
    },
  ];
  const followers = division.memberIds.filter((id) => id !== division.flagshipId);
  followers.forEach((assetId, index) => {
    const ship = ships[assetId]!;
    const ordinal = index + 1;
    const station = stationPoint(
      {
        formation: division.formation,
        ordinal,
        divisionIndex: division.divisionIndex,
        leadPosition: flagship.position,
        leadHeading: flagship.heading,
      },
      ruleset,
    );
    let mode: StationKeepingMode = "STATION";
    let target: StationPoint = station;
    let aim: StationPoint = station;
    if (division.formation === "LINE_AHEAD" && !turnTogether && track !== undefined) {
      const onTrack = pointAtPathDistance(
        track.points,
        ordinal * ruleset.columnIntervalUm,
        flagship.heading,
      );
      if (onTrack !== undefined) {
        mode = "TRACK";
        target = onTrack;
        aim =
          pointAtPathDistance(
            track.points,
            Math.max(0, ordinal * ruleset.columnIntervalUm - ruleset.stationToleranceUm),
            flagship.heading,
          ) ?? onTrack;
      }
    }
    const turning =
      turnTogether &&
      division.formation === "LINE_AHEAD" &&
      flagship.heading !== flagship.orderedHeading;
    if (turning) mode = "TURN_TOGETHER";

    const errorUm = alongHeadingUm(ship.heading, ship.position, target);
    const distanceToTargetUm = distanceM(ship.position, target) * UM_PER_M;
    const offStation = distanceToTargetUm > ruleset.stationToleranceUm;
    let orderedHeading: number;
    if (turning) {
      orderedHeading = flagship.orderedHeading;
    } else if (mode === "TRACK") {
      orderedHeading =
        distanceM(ship.position, aim) === 0
          ? ship.heading
          : bearingDeg(aim[0] - ship.position[0], aim[1] - ship.position[1]);
    } else {
      orderedHeading = offStation
        ? bearingDeg(target[0] - ship.position[0], target[1] - ship.position[1])
        : flagship.heading;
    }
    overrides[assetId] = {
      orderedHeading,
      orderedSpeedBp: turning
        ? Math.min(speedBp, ship.attainableMaxBp)
        : catchUpSpeedBp(speedBp, ship.attainableMaxBp, errorUm, ruleset),
    };
    records.push({
      assetId,
      divisionId: division.divisionId,
      formation: division.formation,
      mode,
      offStation,
      stationErrorM: distanceToTargetUm / UM_PER_M,
      divisionSpeedBp: speedBp,
    });
  });
  return { overrides, records, divisionSpeedBp: speedBp };
}
