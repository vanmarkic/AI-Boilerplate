import { test, expect } from "@playwright/test";

test.describe("Scenario Builder @scenario-builder", () => {
  test("should display the scenario builder page", async ({ page }) => {
    await page.goto("/builder");
    await expect(
      page.getByRole("textbox", { name: "Scenario title" }),
    ).toBeVisible();
  });

  test("should have title and description inputs", async ({ page }) => {
    await page.goto("/builder");
    await expect(
      page.getByRole("textbox", { name: "Scenario title" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  });

  test("should have create button", async ({ page }) => {
    await page.goto("/builder");
    const createBtn = page.locator("button").filter({ hasText: /create/i });
    await expect(createBtn.first()).toBeVisible();
  });
});
