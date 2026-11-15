import { ArrowDown, ArrowRight, ArrowUp, Check, Plus, X, type LucideIcon } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Slate } from "../../../components/slate/Slate.js";
import { SEVERITY_STYLE } from "../../../components/design-workspace/validation/severity.js";
import type {
  AspectChange,
  FeedbackTone,
  FindingChange,
} from "../../../components/design-workspace/designFeedback.js";
import type { LastChange } from "../../../components/design-workspace/lastChange.js";
import { cn } from "../../../lib/utils.js";
import { SECTIONS, type DesignSectionId } from "../design-sections.js";

export interface LastChangeStripProps {
  readonly change: LastChange | null;
  readonly onOpenSection: (section: DesignSectionId) => void;
  readonly onDismiss: () => void;
}

const ARROW: { readonly [D in AspectChange["direction"]]: LucideIcon } = {
  up: ArrowUp,
  down: ArrowDown,
  flat: ArrowRight,
};

const TONE: {
  readonly [T in FeedbackTone]: {
    readonly word: string;
    readonly text: string;
    readonly edge: string;
  };
} = {
  better: {
    word: "better",
    text: "text-emerald-700 dark:text-emerald-400",
    edge: "border-l-emerald-600 dark:border-l-emerald-400",
  },
  worse: { word: "worse", text: "text-destructive", edge: "border-l-destructive" },
  neutral: {
    word: "",
    text: "text-admiralty-ink-muted",
    edge: "border-l-admiralty-border",
  },
};

function AspectItem({
  aspect,
  onOpen,
}: {
  readonly aspect: AspectChange;
  readonly onOpen: (section: DesignSectionId) => void;
}) {
  const Arrow = ARROW[aspect.direction];
  const tone = TONE[aspect.tone];
  const target = SECTIONS[aspect.section].label;
  const spoken = `${aspect.label} ${aspect.text}${tone.word === "" ? "" : `, ${tone.word}`}. Open ${target}`;
  return (
    <li data-aspect={aspect.aspect} data-tone={aspect.tone}>
      <button
        type="button"
        aria-label={spoken}
        title={`Open ${target}`}
        onClick={() => onOpen(aspect.section)}
        className={cn(
          "flex items-center gap-1.5 rounded-sm border border-admiralty-border border-l-4 px-2 py-1 text-xs outline-none hover:bg-admiralty-surface focus-visible:ring-2 focus-visible:ring-ring",
          tone.edge,
        )}
      >
        <Arrow aria-hidden="true" className={cn("size-3.5 shrink-0", tone.text)} />
        <span className="text-admiralty-ink-muted">{aspect.label}</span>
        <span className="font-medium tabular-nums">{aspect.text}</span>
        {tone.word !== "" && <span className={cn("font-medium", tone.text)}>{tone.word}</span>}
      </button>
    </li>
  );
}

function FindingChip({ finding }: { readonly finding: FindingChange }) {
  const { Icon, tone, label } = SEVERITY_STYLE[finding.severity];
  const appeared = finding.change === "new";
  const Mark = appeared ? Plus : Check;
  return (
    <li
      data-finding={finding.id}
      data-change={finding.change}
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-admiralty-border px-2 py-0.5 text-xs"
    >
      <Mark aria-hidden="true" className="size-3 shrink-0" />
      <span className="font-medium">{appeared ? "New" : "Resolved"}</span>
      <Icon aria-hidden="true" className={cn("size-3 shrink-0", tone)} />
      <span className="sr-only">{label}:</span>
      <span className="truncate text-admiralty-ink-muted">{finding.message}</span>
    </li>
  );
}

function Body({ change, onOpenSection, onDismiss }: LastChangeStripProps & { change: LastChange }) {
  const { aspects, findings, hashAfter } = change.feedback;
  const unchanged = aspects.length === 0 && findings.length === 0;
  return (
    <Slate
      key={hashAfter}
      aria-label="Last change"
      data-testid="last-change-strip"
      data-kind={change.kind}
      className="w-[min(40rem,100%)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
    >
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm leading-snug">
            <span className="font-display font-semibold">Last change</span>
            <span className="text-admiralty-ink-muted"> · </span>
            <span data-testid="last-change-label">{change.label}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss last change"
            onClick={onDismiss}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        {unchanged ? (
          <p className="text-xs text-admiralty-ink-muted">No figure or finding moved.</p>
        ) : (
          <>
            {aspects.length > 0 && (
              <ul aria-label="Figures that moved" className="flex flex-wrap gap-1.5">
                {aspects.map((a) => (
                  <AspectItem key={a.aspect} aspect={a} onOpen={onOpenSection} />
                ))}
              </ul>
            )}
            {findings.length > 0 && (
              <ul aria-label="Findings that changed" className="flex flex-wrap gap-1.5">
                {findings.map((f) => (
                  <FindingChip key={`${f.change}:${f.id}:${f.message}`} finding={f} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Slate>
  );
}

export function LastChangeStrip(props: LastChangeStripProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="last-change-region">
      {props.change !== null && <Body {...props} change={props.change} />}
    </div>
  );
}
