import {
  MAX_COURSE_DEG,
  MAX_SPEED_KNOTS,
  MIN_COURSE_DEG,
  MIN_SPEED_KNOTS,
  type DivisionOrder,
} from "../../../../shared/player-battle-orders.js";

export type CourseOrderState = "stance" | "pending" | "accepted";

export function courseOrderState(
  draft: DivisionOrder,
  accepted: DivisionOrder | undefined,
): CourseOrderState {
  if (draft.courseDeg === undefined && draft.speedKnots === undefined) {
    const wasSteered = accepted?.courseDeg !== undefined || accepted?.speedKnots !== undefined;
    return wasSteered ? "pending" : "stance";
  }
  const same =
    accepted !== undefined &&
    accepted.courseDeg === draft.courseDeg &&
    accepted.speedKnots === draft.speedKnots;
  return same ? "accepted" : "pending";
}

export type Parsed = { readonly ok: true; readonly value: number } | { readonly ok: false };

function parseWhole(text: string, minimum: number, maximum: number): Parsed {
  if (!/^\d{1,3}$/u.test(text.trim())) return { ok: false };
  const value = Number(text.trim());
  return value >= minimum && value <= maximum ? { ok: true, value } : { ok: false };
}

export const parseCourse = (text: string): Parsed =>
  parseWhole(text, MIN_COURSE_DEG, MAX_COURSE_DEG);

export const parseSpeedKnots = (text: string): Parsed =>
  parseWhole(text, MIN_SPEED_KNOTS, MAX_SPEED_KNOTS);

export function sameDivisionOrder(
  a: DivisionOrder | undefined,
  b: DivisionOrder | undefined,
): boolean {
  return (
    a?.stance === b?.stance &&
    a?.speedPercent === b?.speedPercent &&
    a?.courseDeg === b?.courseDeg &&
    a?.speedKnots === b?.speedKnots
  );
}
