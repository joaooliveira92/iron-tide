import { useCallback, useMemo, useState } from "react";
import {
  clearEngineAudits,
  getRecordedEngineAudits,
  type StoredEngineAudit,
} from "../../../lib/engine-audit.js";

export interface UseEngineAuditInspectorReturn {
  readonly audits: readonly StoredEngineAudit[];
  readonly selectedAudit: StoredEngineAudit | null;
  readonly setSelectedAudit: (audit: StoredEngineAudit | null) => void;
  readonly clearAudits: () => void;
}

export function useEngineAuditInspector(): UseEngineAuditInspectorReturn {
  const initial = useMemo(() => getRecordedEngineAudits(), []);
  const [audits, setAudits] = useState<readonly StoredEngineAudit[]>(initial);
  const [selectedAudit, setSelectedAudit] = useState<StoredEngineAudit | null>(null);

  const clearAudits = useCallback(() => {
    clearEngineAudits();
    setAudits([]);
    setSelectedAudit(null);
  }, []);

  return {
    audits,
    selectedAudit,
    setSelectedAudit,
    clearAudits,
  };
}
