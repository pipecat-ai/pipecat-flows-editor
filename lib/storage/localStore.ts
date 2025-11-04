const STORAGE_KEY_CURRENT = "pipecat-flows-editor/current";

export function saveCurrent(json: object) {
  try {
    const data = JSON.stringify(json);
    localStorage.setItem(STORAGE_KEY_CURRENT, data);
  } catch {}
}

export function loadCurrent<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
