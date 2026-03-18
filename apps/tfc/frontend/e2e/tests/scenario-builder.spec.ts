import { test, expect } from "@playwright/test";

test.describe("Scenario Builder @scenario-builder", () => {
  test("should display the scenario builder page", async ({ page }) => {
    await page.goto("/builder");
    await expect(page.locator("body")).toContainText(/scenario builder/i);
  });

  test("should have title and description inputs", async ({ page }) => {
    await page.goto("/builder");
    const titleInput = page.locator("input#scenario-title");
    const descInput = page.locator(
      "input#scenario-desc, textarea#scenario-desc",
    );
    await expect(titleInput).toBeVisible();
    await expect(descInput).toBeVisible();
  });

  test("should have create button", async ({ page }) => {
    await page.goto("/builder");
    const createBtn = page.locator("button").filter({ hasText: /create/i });
    await expect(createBtn.first()).toBeVisible();
  });
});
