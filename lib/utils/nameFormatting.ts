/**
 * Generate a Python-safe function name from input
 * Converts to lowercase, replaces spaces and invalid chars with underscores,
 * ensures it doesn't start with a number
 */
export function formatFunctionName(input: string): string {
  if (!input || input.trim() === "") {
    return "";
  }

  // Convert to lowercase, replace spaces and invalid chars with underscores
  let formatted = input
    .toLowerCase()
    .replace(/\s+/g, "_") // Convert spaces (and multiple spaces) to underscores
    .replace(/[^a-z0-9_]/g, "_") // Replace any other invalid chars with underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(formatted)) {
    formatted = `func_${formatted}`;
  }

  return formatted;
}

/**
 * Validate that a function name is a valid Python identifier
 */
export function validateFunctionName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Function name cannot be empty";
  }

  const trimmed = name.trim();

  // Must be valid Python identifier (lowercase, numbers, underscores, no leading number)
  if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
    return "Function name must start with a letter and contain only lowercase letters, numbers, and underscores";
  }

  return null;
}
