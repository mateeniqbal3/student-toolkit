import { expect, test } from "@playwright/test";

test("landing page renders and has no horizontal scroll at 360px", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Student Toolkit");

  await page.setViewportSize({ width: 360, height: 780 });
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
