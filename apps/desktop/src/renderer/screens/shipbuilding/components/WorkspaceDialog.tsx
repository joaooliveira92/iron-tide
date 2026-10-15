import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.js";

/** A whole-design tool opened from the overflow menu (comparison, import, history): not routine editing. */
export function WorkspaceDialog({
  open,
  onClose,
  title,
  description,
  wide = false,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description: string;
  /** A wide, tall dialog for a master/detail browser; the body owns its own scrolling. */
  readonly wide?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={
          wide
            ? "flex h-[85vh] max-h-[85vh] w-[min(92vw,80rem)] max-w-none flex-col overflow-hidden sm:max-w-none"
            : "max-h-[85vh] max-w-3xl overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
