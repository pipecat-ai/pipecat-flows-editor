/**
 * Canvas positions live outside the document. A `FlowConfig` rejects unknown
 * keys, so the editor keeps positions in local storage, keyed by flow name and
 * then by canvas node id (a node name, or a branch node id).
 */

export type Position = { x: number; y: number };
export type NodePositions = Record<string, Position>;

const STORAGE_KEY_PREFIX = "pipecat-flows-editor/positions/";

function storageKey(flowName: string): string {
  return `${STORAGE_KEY_PREFIX}${flowName}`;
}

export function loadPositions(flowName: string): NodePositions {
  try {
    const raw = localStorage.getItem(storageKey(flowName));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isNodePositions(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function savePositions(flowName: string, positions: NodePositions): void {
  try {
    localStorage.setItem(storageKey(flowName), JSON.stringify(positions));
  } catch {}
}

/** The positions of every node on the canvas, keyed by canvas node id. */
export function positionsFromNodes(nodes: ReadonlyArray<{ id: string; position: Position }>) {
  const positions: NodePositions = {};
  for (const node of nodes) positions[node.id] = { x: node.position.x, y: node.position.y };
  return positions;
}

export function clearPositions(flowName: string): void {
  try {
    localStorage.removeItem(storageKey(flowName));
  } catch {}
}

function isNodePositions(value: unknown): value is NodePositions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (p) =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as Position).x === "number" &&
      typeof (p as Position).y === "number"
  );
}
