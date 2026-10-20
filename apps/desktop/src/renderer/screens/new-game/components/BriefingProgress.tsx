import { cn } from "../../../lib/utils.js";

/**
 * The briefing's page sequence as an ordered list: segments for sight, the page
 * titles as text for everyone, and `aria-current="step"` on the current page.
 */
export function BriefingProgress({
  titles,
  currentIndex,
  label,
}: {
  readonly titles: readonly string[];
  readonly currentIndex: number;
  readonly label: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-1.5">
        {titles.map((title, index) => (
          <li
            key={title}
            aria-current={index === currentIndex ? "step" : undefined}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              index <= currentIndex ? "bg-primary" : "bg-border",
            )}
          >
            <span className="sr-only">{title}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
