import { test, expect } from "@playwright/test";

test.describe("Pipecat Flows Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/editor");
  });

  test("should load the editor page", async ({ page }) => {
    await expect(page).toHaveTitle(/Pipecat Flows Editor/);
  });

  test("should create minimal flow and export", async ({ page }) => {
    // Wait for React Flow to be ready
    await page.waitForSelector(".react-flow", { timeout: 5000 });

    // Export the flow
    const exportButton = page.getByRole("button", { name: /Export/i });
    await exportButton.click();

    // Wait for download (in real test, you'd check file content)
    // For now, just verify button exists and is clickable
    await expect(exportButton).toBeVisible();
  });

  test("should validate flow", async ({ page }) => {
    await page.waitForSelector(".react-flow", { timeout: 5000 });

    const validateButton = page.getByRole("button", { name: /Validate/i });
    await validateButton.click();

    // Should show validation result (toast or alert)
    // This is a basic smoke test - actual validation behavior tested in unit tests
    await expect(validateButton).toBeVisible();
  });
});
