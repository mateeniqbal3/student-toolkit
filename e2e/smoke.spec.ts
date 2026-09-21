import { expect, test } from "@playwright/test";

const TOOL_SLUGS = [
  "gpa-calculator",
  "percentage-calculator",
  "unit-converter",
  "citation-generator",
  "timetable-maker",
  "flashcards",
  "pomodoro-timer",
  "notes",
  "pdf-tools",
  "ai-assistant",
];

test("landing page renders with no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/work offline/i);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("every tool route is reachable and has its own title", async ({ page }) => {
  for (const slug of TOOL_SLUGS) {
    const response = await page.goto(`/${slug}`);
    expect(response?.status(), `${slug} should return 200`).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/Student Toolkit/);
  }
});

test("mobile menu opens and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");

  await page.getByRole("button", { name: /open menu/i }).click();

  // The sheet is code-split behind the trigger, so it arrives a beat later.
  // Scoped to the dialog because the tool cards behind it share these names.
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "GPA & CGPA Calculator", exact: true }).click();

  await expect(page).toHaveURL(/\/gpa-calculator$/);
});

test("serves a sitemap, robots file and web manifest", async ({ request }) => {
  for (const path of ["/sitemap.xml", "/robots.txt", "/manifest.webmanifest"]) {
    const response = await request.get(path);
    expect(response.status(), `${path} should return 200`).toBe(200);
  }
});
