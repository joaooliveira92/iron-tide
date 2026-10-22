import { cn } from "../../../lib/utils.js";
import {
  attitudeDetail,
  attitudeLabel,
  outlookDetail,
  outlookLabel,
  statusDetail,
  statusLabel,
  worldText,
} from "../world-situation-copy.js";
import { ATTITUDE_FILL, OUTLOOK_TONE, STATUS_ICON } from "../world-situation-presentation.js";
import type { IntelligenceConfidenceLevel, PowerBrief, PowerOutlook } from "../world-situation.js";

const TENSION_SCALE = 10;

export function OutlookBadge({
  outlook,
  className,
}: {
  readonly outlook: PowerOutlook;
  readonly className?: string;
}) {
  const tone = OUTLOOK_TONE[outlook];
  const Icon = tone.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-semibold", tone.text, className)}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {outlookLabel(outlook)}
    </span>
  );
}

export function TensionIndicator({ power }: { readonly power: PowerBrief }) {
  const filled = Math.max(0, Math.min(TENSION_SCALE, power.tension));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-foreground">
        <span className="font-semibold tabular-nums">
          {worldText("tension.value", { tension: power.tension })}
        </span>
        <span className="text-muted-foreground"> · {worldText("tension.meaning")}</span>
      </p>
      <div
        className="flex gap-0.5"
        role="img"
        aria-label={worldText("tension.meterLabel", { tension: power.tension })}
      >
        {Array.from({ length: TENSION_SCALE }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-[1px]",
              index < filled ? ATTITUDE_FILL[power.attitude] : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function IntelligenceConfidence({
  confidence,
}: {
  readonly confidence: IntelligenceConfidenceLevel | null;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {confidence === null
        ? worldText("confidence.ungraded")
        : worldText(`confidence.${confidence}`)}
    </p>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border py-3 first:border-t-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function RelationshipStatus({ power }: { readonly power: PowerBrief }) {
  const StatusIcon = STATUS_ICON[power.status];
  return (
    <dl>
      <Row label={worldText("dossier.status")}>
        <p className="inline-flex items-center gap-1.5 font-semibold">
          <StatusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {statusLabel(power.status)}
        </p>
        <p className="text-muted-foreground">{statusDetail(power.status)}</p>
        <p className="text-muted-foreground">
          {worldText(power.nonAggressionPact ? "status.pact.in_force" : "status.pact.absent")}
        </p>
      </Row>
      <Row label={worldText("dossier.attitude")}>
        <p className="font-semibold">{attitudeLabel(power.attitude)}</p>
        <p className="mb-2 text-muted-foreground">{attitudeDetail(power.attitude)}</p>
        <TensionIndicator power={power} />
      </Row>
      <Row label={worldText("dossier.outlook")}>
        <OutlookBadge outlook={power.outlook} className="text-sm" />
        <p className="text-muted-foreground">{outlookDetail(power.outlook)}</p>
      </Row>
      <Row label={worldText("confidence.label")}>
        <IntelligenceConfidence confidence={power.confidence} />
      </Row>
    </dl>
  );
}
