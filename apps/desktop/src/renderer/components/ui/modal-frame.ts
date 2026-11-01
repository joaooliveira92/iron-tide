export type ModalSize = "standard" | "confirm";

export const MODAL_SIZE_CLASS: { readonly [K in ModalSize]: string } = {
  standard: "h-[85vh] max-h-[85vh] w-[min(92vw,80rem)]",
  confirm: "max-h-[85vh] w-[min(92vw,32rem)]",
};

export const MODAL_SURFACE_CLASS =
  "fixed left-1/2 top-1/2 z-50 flex max-w-none -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden border bg-background sm:max-w-none sm:rounded-lg data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95";

export const MODAL_PADDING_CLASS = "p-6";

export const MODAL_BODY_CLASS = "flex min-h-0 flex-1 flex-col overflow-y-auto";
