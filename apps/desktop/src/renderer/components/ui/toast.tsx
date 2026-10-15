import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";

/**
 * Toasts (ReUI/sonner-style, https://reui.io/components/sonner), built on the
 * Base UI Toast primitive the rest of the UI already uses rather than adding the
 * Sonner dependency. Toasts appear bottom-right, announce through a live region,
 * and carry optional action buttons.
 */
export interface ToastAction {
  readonly label: React.ReactNode;
  readonly onClick: () => void;
}

export interface ToastOptions {
  /** Re-adding an existing id updates the toast in place instead of stacking a new one. */
  readonly id?: string;
  /** The primary action (e.g. "Start over"). */
  readonly action?: ToastAction;
  /** The secondary action (e.g. "Keep working"). */
  readonly cancel?: ToastAction;
  /** Milliseconds before auto-dismiss; `0` keeps the toast until it is acted on. */
  readonly duration?: number;
  /** Called whenever the toast is closed, however it was dismissed. */
  readonly onClose?: () => void;
}

interface ToastData {
  readonly action?: ToastAction;
  readonly cancel?: ToastAction;
}

const toastManager = Toast.createToastManager<ToastData>();

/** Queues a toast; returns its id so the caller can dismiss it. */
export const toast = (description: React.ReactNode, options: ToastOptions = {}): string =>
  toastManager.add({
    id: options.id,
    description,
    timeout: options.duration ?? 0,
    ...(options.onClose !== undefined ? { onClose: options.onClose } : {}),
    data: {
      ...(options.action !== undefined ? { action: options.action } : {}),
      ...(options.cancel !== undefined ? { cancel: options.cancel } : {}),
    },
  });

/** Closes one toast, or every open toast when no id is given. */
export const dismissToast = (id?: string): void => {
  toastManager.close(id);
};

function ToastItem({ toast: item }: { readonly toast: Toast.Root.ToastObject<ToastData> }) {
  const { close } = Toast.useToastManager<ToastData>();
  const { action, cancel } = item.data ?? {};
  return (
    <Toast.Root
      toast={item}
      className="pointer-events-auto relative w-full rounded-lg border bg-popover p-4 pr-10 text-popover-foreground shadow-lg animate-toast-in motion-reduce:animate-none"
    >
      <Toast.Content className="flex flex-col gap-3">
        <Toast.Description className="text-sm text-popover-foreground" />
        {(cancel !== undefined || action !== undefined) && (
          <div className="flex flex-wrap justify-end gap-2">
            {cancel !== undefined && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  cancel.onClick();
                  close(item.id);
                }}
              >
                {cancel.label}
              </Button>
            )}
            {action !== undefined && (
              <Button
                size="sm"
                onClick={() => {
                  action.onClick();
                  close(item.id);
                }}
              >
                {action.label}
              </Button>
            )}
          </div>
        )}
      </Toast.Content>
      <Toast.Close
        aria-label="Dismiss"
        className={cn(
          "absolute right-2 top-2 grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <X aria-hidden="true" className="size-4" />
      </Toast.Close>
    </Toast.Root>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>();
  return toasts.map((item) => <ToastItem key={item.id} toast={item} />);
}

/** Renders the toast viewport. Mount once, near the app root. */
export function Toaster() {
  return (
    <Toast.Provider limit={3} timeout={0} toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
