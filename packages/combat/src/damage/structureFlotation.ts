export interface StructureFlotationInput {
  structuralDamage: number;
  flotationDamage: number;
  currentStructuralIntegrity: number;
  currentFlotationReserve: number;
}

export interface StructureFlotationResult {
  structuralIntegrityAfter: number;
  flotationReserveAfter: number;
  uncappedStructuralDamage: number;
  uncappedFlotationDamage: number;
}

export function resolveStructureFlotation(
  input: StructureFlotationInput,
): StructureFlotationResult {
  const { structuralDamage, flotationDamage, currentStructuralIntegrity, currentFlotationReserve } =
    input;

  const structuralIntegrityAfter = Math.max(0, currentStructuralIntegrity - structuralDamage);
  const flotationReserveAfter = Math.max(0, currentFlotationReserve - flotationDamage);

  const uncappedStructuralDamage = structuralDamage;
  const uncappedFlotationDamage = flotationDamage;

  return {
    structuralIntegrityAfter,
    flotationReserveAfter,
    uncappedStructuralDamage,
    uncappedFlotationDamage,
  };
}
