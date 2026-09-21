import { expect, test, type Page } from "@playwright/test";

const RATE_HOSTS = /open\.er-api\.com|api\.exchangerate\.host|api\.frankfurter\.app/;

async function chooseCategory(page: Page, value: string) {
  await page.getByLabel("What are you converting?").selectOption(value);
}

test.describe("Unit converter", () => {
  test("converts through the category's base unit", async ({ page }) => {
    await page.goto("/unit-converter");

    const result = page.getByRole("region", { name: "Result" });
    await expect(result).toContainText("0.6213711922");
  });

  test("handles the offset scales that a plain factor cannot", async ({ page }) => {
    await page.goto("/unit-converter");
    await chooseCategory(page, "temperature");

    await page.getByLabel("Amount").fill("100");
    await expect(page.getByRole("region", { name: "Result" })).toContainText("212");

    await page.getByLabel("Amount").fill("-40");
    // The one temperature where the two scales agree.
    await expect(page.getByRole("region", { name: "Result" })).toContainText("-40");
  });

  test("refuses a temperature below absolute zero instead of converting it", async ({ page }) => {
    await page.goto("/unit-converter");
    await chooseCategory(page, "temperature");
    await page.getByLabel("Amount").fill("-400");

    // Scoped to the result: Next's route announcer is also role=alert.
    const result = page.getByRole("region", { name: "Result" });
    await expect(result.getByRole("alert")).toContainText(/colder than absolute zero/);
  });

  test("swaps the two units", async ({ page }) => {
    await page.goto("/unit-converter");

    await expect(page.getByLabel("From")).toHaveValue("km");
    await expect(page.getByLabel("To")).toHaveValue("mi");

    await page.getByRole("button", { name: "Swap the two units" }).click();

    await expect(page.getByLabel("From")).toHaveValue("mi");
    await expect(page.getByLabel("To")).toHaveValue("km");
  });

  test("answers the whole category at once", async ({ page }) => {
    await page.goto("/unit-converter");

    const all = page.getByRole("region", { name: /Every length unit/i });
    await expect(all.getByRole("listitem").filter({ hasText: "Centimetre" })).toContainText(
      "100,000",
    );
  });

  test("remembers the category across a reload", async ({ page }) => {
    await page.goto("/unit-converter");
    await chooseCategory(page, "pressure");
    await page.reload();

    await expect(page.getByLabel("What are you converting?")).toHaveValue("pressure");
  });

  test("fits a 360px screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/unit-converter");

    await expect(page.getByRole("region", { name: "Result" })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});

test.describe("Currency", () => {
  test("converts at the fetched rate and says where it came from", async ({ page }) => {
    await page.route("**://open.er-api.com/**", (route) =>
      route.fulfill({
        json: {
          rates: { PKR: 278.5, EUR: 0.92, GBP: 0.79 },
          time_last_update_utc: "Sat, 10 Jan 2026 00:00:01 +0000",
        },
      }),
    );

    await page.goto("/unit-converter");
    await chooseCategory(page, "currency");

    const result = page.getByRole("region", { name: "Converted amount" });
    await expect(result).toContainText("27,850");
    await expect(page.getByText(/Rates as of 2026-01-10, from open\.er-api\.com/)).toBeVisible();
  });

  test("falls back to the next provider when the first one fails", async ({ page }) => {
    await page.route("**://open.er-api.com/**", (route) => route.abort());
    await page.route("**://api.exchangerate.host/**", (route) =>
      route.fulfill({ json: { rates: { PKR: 279 }, date: "2026-01-09" } }),
    );

    await page.goto("/unit-converter");
    await chooseCategory(page, "currency");

    await expect(page.getByText(/from exchangerate\.host/)).toBeVisible();
  });

  test("says plainly when there are no rates and no cache, rather than showing nothing", async ({
    page,
  }) => {
    await page.route(RATE_HOSTS, (route) => route.abort());

    await page.goto("/unit-converter");
    await chooseCategory(page, "currency");

    await expect(page.getByRole("status")).toContainText(/no saved rates on this device/);
  });

  test("keeps working offline from the cached table", async ({ page }) => {
    await page.route("**://open.er-api.com/**", (route) =>
      route.fulfill({
        json: { rates: { PKR: 278.5 }, time_last_update_utc: "Sat, 10 Jan 2026 00:00:01 +0000" },
      }),
    );

    await page.goto("/unit-converter");
    await chooseCategory(page, "currency");
    await expect(page.getByRole("region", { name: "Converted amount" })).toContainText("27,850");

    // Every provider now unreachable, but the table is in IndexedDB.
    await page.unroute("**://open.er-api.com/**");
    await page.route(RATE_HOSTS, (route) => route.abort());

    await page.reload();
    await chooseCategory(page, "currency");
    await expect(page.getByRole("region", { name: "Converted amount" })).toContainText("27,850");
  });
});
