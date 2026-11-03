import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import { useEffect, useState } from "react";
import {
  MAX_SPEED_KNOTS,
  MIN_SPEED_KNOTS,
  playerSideOf,
  type DivisionOrder,
} from "../../../../shared/player-battle-orders.js";
import type { FormattingLocale } from "../../../../shared/preferences-contract.js";
import { Button } from "../../../components/ui/button.js";
import { formatNumber } from "../../../lib/presentation-format/format.js";
import { translate } from "../../../lib/strings.js";
import { BattleExplanationDisclosure } from "../BattleExplanationDisclosure.js";
import { compassFromHeading, headingFromCompass } from "./tactical-geometry.js";
import { divisionOfShip, selectedShip, shortDivisionId } from "./tactical-model.js";
import { courseOrderState, parseCourse, parseSpeedKnots } from "./tactical-orders.js";

export interface UnitCommandPanelProps {
  readonly view: PlayerBattleView;
  readonly locale: FormattingLocale;
  readonly selectedShipId: string | null;
  readonly orderFor: (divisionId: string) => DivisionOrder;
  readonly acceptedOrders: Readonly<Record<string, DivisionOrder>>;
  readonly setOrder: (divisionId: string, patch: Partial<DivisionOrder>) => void;
  readonly releaseCourse: (divisionId: string) => void;
  readonly onPreviewCourse: (headingDeg: number | null) => void;
}

const MILLI_KNOTS_PER_KNOT = 1_000;

const pad = (degrees: number): string => String(degrees).padStart(3, "0");

export function UnitCommandPanel(props: UnitCommandPanelProps) {
  const { view, selectedShipId, orderFor, acceptedOrders } = props;
  const ship = selectedShip(view, selectedShipId);
  const divisionId = ship === null ? null : divisionOfShip(view, ship.shipId);
  const own = ship !== null && ship.sideId === playerSideOf(view);
  const division = divisionId === null ? undefined : orderFor(divisionId);
  const accepted = divisionId === null ? undefined : acceptedOrders[divisionId];

  const [courseText, setCourseText] = useState("");
  const [speedText, setSpeedText] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setTouched(false);
    const standing = division?.courseDeg;
    setCourseText(standing === undefined ? "" : pad(compassFromHeading(standing)));
    setSpeedText(division?.speedKnots === undefined ? "" : String(division.speedKnots));
  }, [divisionId, division?.courseDeg, division?.speedKnots]);

  useEffect(() => {
    const parsed = parseCourse(courseText);
    props.onPreviewCourse(parsed.ok && touched ? headingFromCompass(parsed.value) : null);
    return () => props.onPreviewCourse(null);
  }, [courseText, touched, props.onPreviewCourse]);

  if (ship === null) {
    return (
      <section
        data-testid="unit-panel"
        aria-label="Selected unit"
        className="rounded border border-border p-2 text-xs text-muted-foreground"
      >
        {translate("tactical.unit.none")}
      </section>
    );
  }

  const heading = ship.headingDeg === null ? null : compassFromHeading(ship.headingDeg);
  const knotsNow = ship.speedBp === null ? null : ship.speedBp / MILLI_KNOTS_PER_KNOT;
  const course = parseCourse(courseText);
  const speed = parseSpeedKnots(speedText);
  const canApply = course.ok && speed.ok && !view.ended;
  const state = division === undefined ? "stance" : courseOrderState(division, accepted);

  return (
    <section
      data-testid="unit-panel"
      aria-label="Selected unit"
      className="space-y-2 rounded border border-border p-2 text-xs"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {translate("tactical.unit.title", { name: ship.name })}
        </h3>
        {divisionId === null ? null : (
          <span className="text-muted-foreground">
            {translate("tactical.unit.division", { division: shortDivisionId(divisionId) })}
          </span>
        )}
      </header>
      <dl className="grid grid-cols-[auto_auto_auto_auto] justify-start gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{translate("tactical.unit.course_now")}</dt>
        <dd data-testid="unit-course-now">
          {heading === null
            ? translate("tactical.unit.unknown")
            : translate("tactical.unit.degrees", { value: pad(heading) })}
        </dd>
        <dt className="text-muted-foreground">{translate("tactical.unit.speed_now")}</dt>
        <dd data-testid="unit-speed-now">
          {knotsNow === null
            ? translate("tactical.unit.unknown")
            : translate("tactical.unit.knots", {
                value: formatNumber(knotsNow, {
                  locale: props.locale,
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })}
        </dd>
        {own && division?.courseDeg !== undefined && (
          <>
            <dt className="text-muted-foreground">{translate("tactical.unit.course_requested")}</dt>
            <dd data-testid="unit-course-requested">
              {translate("tactical.unit.degrees", {
                value: pad(compassFromHeading(division.courseDeg)),
              })}
            </dd>
          </>
        )}
        {own && division?.speedKnots !== undefined && (
          <>
            <dt className="text-muted-foreground">{translate("tactical.unit.speed_requested")}</dt>
            <dd data-testid="unit-speed-requested">
              {translate("tactical.unit.knots", { value: division.speedKnots })}
            </dd>
          </>
        )}
      </dl>
      {ship.motion === undefined ? null : (
        <BattleExplanationDisclosure
          tree={ship.motion}
          locale={props.locale}
          summaryKey="battle.ship_motion.summary"
        />
      )}
      {!own && <p>{translate("tactical.unit.no_orders", { name: ship.name })}</p>}
      {own && divisionId === null && (
        <p>{translate("tactical.unit.no_division", { name: ship.name })}</p>
      )}
      {own && divisionId !== null && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!course.ok || !speed.ok) return;
            props.setOrder(divisionId, {
              courseDeg: headingFromCompass(course.value),
              speedKnots: speed.value,
            });
          }}
        >
          <div className="flex flex-wrap items-start gap-3">
            <label className="flex flex-col gap-0.5">
              {translate("tactical.unit.course_input")}
              <input
                data-testid="unit-course-input"
                inputMode="numeric"
                className="w-20 rounded border border-border bg-background px-1 py-0.5"
                value={courseText}
                disabled={view.ended}
                aria-invalid={touched && !course.ok}
                onChange={(event) => {
                  setTouched(true);
                  setCourseText(event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              {translate("tactical.unit.speed_input")}
              <input
                data-testid="unit-speed-input"
                inputMode="numeric"
                className="w-20 rounded border border-border bg-background px-1 py-0.5"
                value={speedText}
                disabled={view.ended}
                aria-invalid={touched && !speed.ok}
                onChange={(event) => {
                  setTouched(true);
                  setSpeedText(event.target.value);
                }}
              />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" data-testid="unit-apply" disabled={!canApply}>
                {translate("tactical.unit.apply")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="unit-release"
                disabled={view.ended || division?.courseDeg === undefined}
                onClick={() => props.releaseCourse(divisionId)}
              >
                {translate("tactical.unit.release")}
              </Button>
            </div>
          </div>
          {touched && !course.ok && (
            <p role="alert" className="text-red-400">
              {translate("tactical.unit.invalid_course")}
            </p>
          )}
          {touched && !speed.ok && (
            <p role="alert" className="text-red-400">
              {translate("tactical.unit.invalid_speed", {
                min: MIN_SPEED_KNOTS,
                max: MAX_SPEED_KNOTS,
              })}
            </p>
          )}
          <p data-testid="unit-order-state" data-state={state} role="status">
            {state === "pending"
              ? translate("tactical.unit.state_pending")
              : state === "accepted"
                ? translate("tactical.unit.state_accepted")
                : translate("tactical.unit.state_stance")}
          </p>
        </form>
      )}
    </section>
  );
}
