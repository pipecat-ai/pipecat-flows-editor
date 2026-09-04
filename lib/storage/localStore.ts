/**
 * Autosave. The current flow is stored as YAML text plus its name; canvas
 * positions are stored separately by `positionStore`.
 */

export interface StoredFlow {
  flowName: string;
  yaml: string;
}

const STORAGE_KEY_FLOW = "pipecat-flows-editor/flow";

/** Where the editor kept its old JSON documents; read only by the legacy importer. */
export const LEGACY_STORAGE_KEY = "pipecat-flows-editor/current";

export function saveCurrentFlow(flow: StoredFlow): void {
  try {
    localStorage.setItem(STORAGE_KEY_FLOW, JSON.stringify(flow));
  } catch {}
}

export function loadCurrentFlow(): StoredFlow | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FLOW);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredFlow).flowName === "string" &&
      typeof (parsed as StoredFlow).yaml === "string"
    ) {
      return parsed as StoredFlow;
    }
    return null;
  } catch {
    return null;
  }
}
