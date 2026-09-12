/** Reads a flow file the user chose or dropped, refusing one too large to be a config. */

export const MAX_FLOW_FILE_BYTES = 5 * 1024 * 1024;

export function readFlowFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FLOW_FILE_BYTES) {
      reject(new Error(`${file.name} is larger than 5 MB, which is too big for a flow config`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsText(file);
  });
}
