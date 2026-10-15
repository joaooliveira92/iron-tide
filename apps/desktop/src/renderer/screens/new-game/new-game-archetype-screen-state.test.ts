import { describe, expect, it } from "vite-plus/test";
import { ARCHETYPE_PRESETS, type ArchetypeSelection } from "@bluewave/campaign-engine";
import {
  allocationErrors,
  createCustomArchetype,
  customizeSelection,
  editorToSelection,
  isAllocationValid,
  resetCustomAllocation,
  restoreArchetypeEditorState,
  selectPreset,
  setDimension,
  type ArchetypeEditorState,
} from "./new-game-archetype-screen-state.js";

const merchantPrincess: ArchetypeSelection = {
  kind: "preset",
  id: "merchant_prince",
  allocation: { ...ARCHETYPE_PRESETS[0]!.allocation },
};

const state = (): ArchetypeEditorState => restoreArchetypeEditorState(merchantPrincess);

describe("new-game archetype screen state", () => {
  it("restores a preset selection into preset mode", () => {
    const editor = restoreArchetypeEditorState(merchantPrincess);
    expect(editor.mode).toBe("preset");
    expect(editor.selectedPresetId).toBe("merchant_prince");
    expect(editorToSelection(editor)).toEqual(merchantPrincess);
  });

  it("selecting a preset updates the allocation and stays in preset mode", () => {
    const editor = selectPreset(state(), "grand_admiral");
    expect(editor.mode).toBe("preset");
    expect(editor.selectedPresetId).toBe("grand_admiral");
    expect(editor.allocation).toEqual(ARCHETYPE_PRESETS[2]!.allocation);
    expect(isAllocationValid(editor)).toBe(true);
  });

  it("customize copies the current allocation into an editable custom editor", () => {
    const editor = customizeSelection(state());
    expect(editor.mode).toBe("custom");
    expect(editor.allocation).toEqual(ARCHETYPE_PRESETS[0]!.allocation);
    // Edits are now possible in custom mode.
    const edited = setDimension(editor, "economy", 9);
    expect(edited.allocation.economy).toBe(9);
  });

  it("create-your-own starts from the neutral balanced allocation", () => {
    const editor = createCustomArchetype();
    expect(editor.mode).toBe("custom");
    expect(editor.allocation).toEqual({ economy: 7, industry: 7, combat: 6 });
  });

  it("setDimension is ignored outside custom mode", () => {
    const editor = setDimension(state(), "economy", 9);
    expect(editor.allocation.economy).toBe(ARCHETYPE_PRESETS[0]!.allocation.economy);
  });

  it("reports an invalid total allocation", () => {
    let editor = customizeSelection(state());
    editor = setDimension(editor, "combat", 10);
    editor = setDimension(editor, "industry", 3);
    // economy stays 10 -> 10 + 3 + 10 = 23, invalid
    expect(isAllocationValid(editor)).toBe(false);
    expect(allocationErrors(editor).length).toBeGreaterThan(0);
  });

  it("is valid when all 20 points are within bounds", () => {
    let editor = customizeSelection(state());
    editor = setDimension(editor, "economy", 10);
    editor = setDimension(editor, "industry", 5);
    editor = setDimension(editor, "combat", 5);
    expect(isAllocationValid(editor)).toBe(true);
  });

  it("respects per-dimension limits", () => {
    let editor = customizeSelection(state());
    editor = setDimension(editor, "economy", 11);
    expect(editor.allocation.economy).toBe(11);
    const result = isAllocationValid(editor);
    expect(result).toBe(false);
  });

  it("reset returns a custom editor to the balanced baseline", () => {
    let editor = customizeSelection(state());
    editor = setDimension(editor, "economy", 10);
    expect(editor.allocation.economy).toBe(10);
    const reset = resetCustomAllocation(editor);
    expect(reset.allocation).toEqual({ economy: 7, industry: 7, combat: 6 });
  });

  it("a custom editor serialises to a custom selection", () => {
    const editor = customizeSelection(state());
    const selection = editorToSelection(editor);
    expect(selection.kind).toBe("custom");
    expect(selection.allocation).toEqual(ARCHETYPE_PRESETS[0]!.allocation);
  });
});
