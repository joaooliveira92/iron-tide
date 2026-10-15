/**
 * The header's continue button is a single, global "next" control whose
 * meaning depends on the active screen. A screen that owns a primary action
 * registers it here; the header renders whatever was last registered and
 * clears to its idle placeholder once the owning screen unmounts.
 */
export interface PrimaryAction {
  readonly label: string;
  readonly disabled: boolean;
  readonly onTrigger: () => void;
}

export type SetPrimaryAction = (action: PrimaryAction | null) => void;
