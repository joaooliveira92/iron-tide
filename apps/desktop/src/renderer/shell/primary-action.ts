export interface PrimaryAction {
  readonly label: string;
  readonly disabled: boolean;
  readonly onTrigger: () => void;
}

export type SetPrimaryAction = (action: PrimaryAction | null) => void;
