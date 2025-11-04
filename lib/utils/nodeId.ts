/**
 * Generate a Python-safe node ID from a label
 * Converts label to lowercase, replaces invalid chars with underscores,
 * ensures it doesn't start with a number, and handles duplicates
 */
export function generateNodeIdFromLabel(label: string, existingIds: string[] = []): string {
  if (!label || label.trim() === "") {
    return "node";
  }

  // Convert to lowercase and replace invalid chars with underscores
  let baseId = label
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(baseId)) {
    baseId = `node_${baseId}`;
  }

  // Ensure it's not empty
  if (baseId === "") {
    baseId = "node";
  }

  // Handle duplicates
  let finalId = baseId;
  let counter = 1;
  while (existingIds.includes(finalId)) {
    finalId = `${baseId}_${counter}`;
    counter++;
  }

  return finalId;
}
