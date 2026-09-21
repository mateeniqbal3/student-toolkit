import { expect, test } from "@playwright/test";

const PHONE = { width: 360, height: 780 };

async function hasHorizontalScroll(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

test.describe("GPA calculator", () => {
  test("weights courses by credit and shows a cumulative figure", async ({ page }) => {
    await page.goto("/gpa-calculator");

    // The first semester is seeded, so there is something to type into.
    const semester = page.getByRole("region", { name: "Semester 1" });
    await expect(semester).toBeVisible();

    await page.getByLabel("Course 1 credit hours").fill("3");
    await page.getByLabel("Course 1 grade").selectOption("A");
    await page.getByLabel("Course 2 credit hours").fill("1");
    await page.getByLabel("Course 2 grade").selectOption("C");

    // (4 x 3 + 2 x 1) / 4 = 3.50
    const summary = page.getByRole("region", { name: "Results" });
    await expect(summary).toContainText("3.50");
    await expect(summary).toContainText("4");
  });

  test("keeps the transcript across a reload", async ({ page }) => {
    await page.goto("/gpa-calculator");
    await page.getByLabel("Course 1 name").fill("Linear Algebra");
    await page.getByLabel("Course 1 grade").selectOption("A");

    await expect(page.getByRole("region", { name: "Results" })).toContainText("4.00");

    await page.reload();
    await expect(page.getByLabel("Course 1 name")).toHaveValue("Linear Algebra");
  });

  test("solves for the GPA a target needs", async ({ page }) => {
    await page.goto("/gpa-calculator");

    await page.getByLabel("Current CGPA").fill("3");
    await page.getByLabel("Credits completed").fill("60");
    await page.getByLabel("Credits this semester").fill("15");
    await page.getByLabel("Target CGPA (out of 4)").fill("3.05");

    await expect(page.getByText(/Average 3\.25 this semester/)).toBeVisible();
  });

  test("says so when a target is out of reach rather than printing a number to chase", async ({
    page,
  }) => {
    await page.goto("/gpa-calculator");

    await page.getByLabel("Current CGPA").fill("3");
    await page.getByLabel("Credits completed").fill("60");
    await page.getByLabel("Credits this semester").fill("15");
    await page.getByLabel("Target CGPA (out of 4)").fill("3.5");

    await expect(page.getByText(/above the 4 maximum/)).toBeVisible();
  });

  test("fits a 360px screen", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/gpa-calculator");
    await expect(page.getByRole("region", { name: "Semester 1" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe("Percentage calculator", () => {
  test("shows the working, not just the answer", async ({ page }) => {
    await page.goto("/percentage-calculator");

    await page.getByLabel("Percentage").fill("15");
    await page.getByLabel("Of what number").fill("200");

    await expect(page.getByText("15% × 200 = 15 ÷ 100 × 200 = 30")).toBeVisible();
  });

  test("works a discount backwards to the original price", async ({ page }) => {
    await page.goto("/percentage-calculator");

    await page.getByRole("button", { name: "Work backwards" }).click();
    await page.getByRole("button", { name: "Decrease" }).click();
    await page.getByLabel("Number after the change").fill("2800");
    await page.getByLabel("Percentage that was applied").fill("20");

    // 3,500 rather than the 3,360 that adding 20% back would give.
    await expect(page.getByText(/Before the decrease, the value was 3,500/)).toBeVisible();
  });

  test("scores a weighted grade against the weight entered so far", async ({ page }) => {
    await page.goto("/percentage-calculator");
    await page.getByRole("button", { name: "Weighted grade" }).click();

    await page.getByLabel("Component 1 marks obtained").fill("18");
    await page.getByLabel("Component 1 total marks").fill("20");
    await page.getByLabel("Component 1 weight percent").fill("40");

    await expect(page.getByText("90%")).toBeVisible();
    await expect(page.getByText(/Based on 40% of the course/)).toBeVisible();
  });

  test("fits a 360px screen", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/percentage-calculator");
    await expect(page.getByRole("button", { name: "Weighted grade" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
