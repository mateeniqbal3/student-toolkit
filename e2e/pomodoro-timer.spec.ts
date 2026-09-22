import { expect, test, type Page } from "@playwright/test";

// Playwright's fake clock drives Date.now and timers alike, so a 25-minute
// session takes no real time. It cannot be paused, because IndexedDB change
// notifications need timers to run, so it also ticks on in real time.
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 22, 9, 0, 0) });
  await page.goto("/pomodoro-timer");
});

function timer(page: Page) {
  return page.getByRole("timer");
}

/** A running countdown showing `clock`, or up to ten real seconds past it. */
function near(clock: string): RegExp {
  const [minutes = 0, seconds = 0] = clock.split(":").map(Number);
  const total = minutes * 60 + seconds;
  const shown = Array.from({ length: 11 }, (_, back) => {
    const left = total - back;
    return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  });
  return new RegExp(`^(${shown.join("|")})$`);
}

function phaseButton(page: Page, name: string) {
  return page.getByRole("group", { name: "Phase" }).getByRole("button", { name });
}

test.describe("Pomodoro timer", () => {
  test("counts down, pauses without losing time, and resumes", async ({ page }) => {
    await expect(timer(page)).toHaveText("25:00");
    await page.getByRole("button", { name: "Start" }).click();

    await page.clock.fastForward("05:00");
    await expect(timer(page)).toHaveText(near("20:00"));
    await expect(page).toHaveTitle(/^(20:00|19:5\d) · Focus/);

    await page.getByRole("button", { name: "Pause" }).click();
    const paused = await timer(page).textContent();
    await page.clock.fastForward("10:00");
    // Paused means exactly paused: not a second lost.
    await expect(timer(page)).toHaveText(paused ?? "");

    await page.getByRole("button", { name: "Resume" }).click();
    await page.clock.fastForward("01:00");
    await expect(timer(page)).toHaveText(
      near(`${Number(paused?.slice(0, 2)) - 1}:${paused?.slice(3)}`),
    );
  });

  test("finishes a focus session, credits the task and moves to a break", async ({ page }) => {
    await page.getByLabel("New task").fill("Linear algebra sheet");
    await page.getByLabel("Pomodoros").fill("3");
    await page.getByRole("button", { name: "Add task" }).click();
    // The first task becomes the current one.
    await expect(page.getByLabel("Working on")).toHaveValue(/\d+/);

    await page.getByRole("button", { name: "Start" }).click();
    await page.clock.fastForward("25:01");

    await expect(phaseButton(page, "Short break")).toHaveAttribute("aria-pressed", "true");
    await expect(timer(page)).toHaveText("05:00");
    await expect(page.getByText("Pomodoro 1 of 4")).toBeVisible();
    await expect(page.getByRole("list", { name: "Open tasks" })).toContainText("1/3");
    await expect(page.getByText("Focused today").locator("..")).toContainText("25 min");
    await expect(page.getByText("Pomodoros today").locator("..")).toContainText("1");
  });

  test("keeps running across a reload, and settles a session that ended meanwhile", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start" }).click();
    await page.clock.fastForward("03:00");
    await page.reload();
    await expect(timer(page)).toHaveText(near("22:00"));
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.clock.fastForward("30:00");
    await page.reload();
    await expect(phaseButton(page, "Short break")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Pomodoros today").locator("..")).toContainText("1");
  });

  test("skipping keeps the minutes focused but does not count a pomodoro", async ({ page }) => {
    await page.getByRole("button", { name: "Start" }).click();
    await page.clock.fastForward("10:00");
    await page.getByRole("button", { name: "Skip to break" }).click();

    await expect(phaseButton(page, "Short break")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Focused today").locator("..")).toContainText("10 min");
    await expect(page.getByText("Pomodoros today").locator("..")).toContainText("0");
  });

  test("uses the configured lengths", async ({ page }) => {
    await page.getByText("Timer settings").click();
    await page.getByLabel("Focus (minutes)").fill("50");
    await expect(timer(page)).toHaveText("50:00");
    await phaseButton(page, "Long break").click();
    await expect(timer(page)).toHaveText("15:00");

    await page.reload();
    await expect(timer(page)).toHaveText("15:00");
  });

  test("ticks off and deletes tasks, with undo", async ({ page }) => {
    for (const title of ["Essay outline", "Lab report"]) {
      await page.getByLabel("New task").fill(title);
      await page.getByRole("button", { name: "Add task" }).click();
      await expect(page.getByRole("list", { name: "Open tasks" })).toContainText(title);
    }

    // A click, not check(): the ticked task moves straight to the done list.
    await page.getByRole("checkbox", { name: /Essay outline/ }).click();
    await expect(page.getByRole("list", { name: "Open tasks" })).not.toContainText("Essay outline");
    await expect(page.getByText("Done (1)")).toBeVisible();

    await page.getByRole("button", { name: "Delete task Lab report" }).click();
    await expect(page.getByText("Deleted “Lab report”.")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("list", { name: "Open tasks" })).toContainText("Lab report");
  });

  test("works on a 360px screen with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page
      .getByLabel("New task")
      .fill("A long task title that should wrap rather than overflow");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByText("Timer settings").click();
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
