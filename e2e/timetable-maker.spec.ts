import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 360, height: 780 };

interface ClassInput {
  title: string;
  days: string[];
  start: string;
  end: string;
  room?: string;
}

async function addClass(page: Page, input: ClassInput) {
  await page.getByRole("button", { name: "Add class" }).click();
  const form = page.getByRole("region", { name: "New class" });
  await form.getByLabel("Course").fill(input.title);

  // The form opens with the first shown day selected; set exactly the ones asked for.
  for (const day of [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]) {
    const button = form.getByRole("button", { name: day, exact: true });
    const pressed = (await button.getAttribute("aria-pressed")) === "true";
    if (pressed !== input.days.includes(day)) await button.click();
  }

  await form.getByLabel("Starts").fill(input.start);
  await form.getByLabel("Ends").fill(input.end);
  if (input.room) await form.getByLabel("Room").fill(input.room);
  await form.getByRole("button", { name: "Add to timetable" }).click();
  await expect(form).toBeHidden();
}

function week(page: Page) {
  return page.getByRole("region", { name: "Week view" });
}

test.describe("Timetable maker", () => {
  test("puts a class on several days at once", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/timetable-maker");

    await addClass(page, {
      title: "Linear Algebra",
      days: ["Monday", "Wednesday"],
      start: "09:00",
      end: "10:30",
      room: "LT-3",
    });

    await expect(week(page).getByRole("button", { name: /^Linear Algebra/ })).toHaveCount(2);
    await expect(
      week(page).getByRole("button", {
        name: /Linear Algebra, Lecture, Wednesday 9:00 am–10:30 am, LT-3/,
      }),
    ).toBeVisible();
    await expect(page.getByText("2 classes · 3 h a week")).toBeVisible();
  });

  test("warns about a clash while typing, and lists it after saving", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/timetable-maker");
    await addClass(page, { title: "Maths", days: ["Monday"], start: "09:00", end: "10:30" });

    await page.getByRole("button", { name: "Add class" }).click();
    const form = page.getByRole("region", { name: "New class" });
    await form.getByLabel("Course").fill("Physics");
    await form.getByLabel("Starts").fill("10:00");
    await form.getByLabel("Ends").fill("11:00");
    await expect(form.getByRole("status")).toContainText(
      "Clashes with Maths (Monday 9:00 am–10:30 am)",
    );
    await form.getByRole("button", { name: "Add to timetable" }).click();

    const clashes = page.getByRole("region", { name: "Clashes" });
    await expect(clashes).toContainText("1 clash");
    await expect(clashes).toContainText("Maths and Physics overlap on Monday, 10:00 am–10:30 am.");
    await expect(
      week(page).getByRole("button", { name: /clashes with another class/ }),
    ).toHaveCount(2);
  });

  test("gives a course's other classes the same colour", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/timetable-maker");
    await addClass(page, { title: "Chemistry", days: ["Monday"], start: "09:00", end: "10:00" });
    await addClass(page, { title: "Biology", days: ["Tuesday"], start: "09:00", end: "10:00" });

    await page.getByRole("button", { name: "Add class" }).click();
    const form = page.getByRole("region", { name: "New class" });
    await form.getByLabel("Course").fill("Chemistry");
    await expect(form.getByRole("radio", { name: "Colour 1" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await form.getByLabel("Course").fill("Geology");
    await expect(form.getByRole("radio", { name: "Colour 3" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("edits, deletes and restores a class, and keeps it across a reload", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/timetable-maker");
    await addClass(page, { title: "History", days: ["Tuesday"], start: "14:00", end: "15:00" });

    await week(page)
      .getByRole("button", { name: /^History/ })
      .click();
    const form = page.getByRole("region", { name: "Edit class" });
    await form.getByLabel("Room").fill("Room 12");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(week(page).getByRole("button", { name: /History.*Room 12/ })).toBeVisible();

    await page.reload();
    await expect(week(page).getByRole("button", { name: /History.*Room 12/ })).toBeVisible();

    await week(page)
      .getByRole("button", { name: /^History/ })
      .click();
    await page.getByRole("button", { name: "Delete class" }).click();
    await expect(week(page).getByRole("button", { name: /^History/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(week(page).getByRole("button", { name: /^History/ })).toHaveCount(1);
  });

  test("refuses a class that ends before it starts", async ({ page }) => {
    await page.goto("/timetable-maker");
    await page.getByRole("button", { name: "Add class" }).click();
    const form = page.getByRole("region", { name: "New class" });
    await form.getByLabel("Course").fill("Backwards");
    await form.getByLabel("Starts").fill("11:00");
    await form.getByLabel("Ends").fill("10:00");
    await form.getByRole("button", { name: "Add to timetable" }).click();
    await expect(form.getByText("The class has to end after it starts.")).toBeVisible();
  });

  test("exports an .ics calendar with weekly repeating events", async ({ page }) => {
    await page.goto("/timetable-maker");
    await addClass(page, { title: "Statistics", days: ["Thursday"], start: "11:00", end: "12:00" });

    await page.getByRole("button", { name: "Calendar" }).click();
    await page.getByLabel("First day of term").fill("2026-09-21");
    await page.getByLabel("Last day of term").fill("2027-01-08");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download .ics" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("my-timetable.ics");

    const ics = await readFile(await download.path(), "utf8");
    expect(ics).toContain("DTSTART:20260924T110000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20270108T235959");
    expect(ics).toContain("SUMMARY:Statistics");
  });

  test("exports the week as a PNG", async ({ page }) => {
    await page.goto("/timetable-maker");
    await addClass(page, { title: "Economics", days: ["Friday"], start: "09:00", end: "10:00" });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Image" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("my-timetable.png");
    const bytes = await readFile(await download.path());
    // The PNG signature.
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("keeps separate timetables, and duplicates one to try an alternative", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/timetable-maker");
    await addClass(page, { title: "Option A", days: ["Monday"], start: "09:00", end: "10:00" });

    await page.getByRole("button", { name: "Duplicate this timetable" }).click();
    await page.getByRole("textbox", { name: "Timetable" }).fill("Plan B");
    await page.getByRole("button", { name: "Done renaming" }).click();
    await expect(week(page).getByRole("button", { name: /^Option A/ })).toHaveCount(1);

    await page.getByRole("button", { name: "New timetable" }).click();
    await page.getByRole("button", { name: "Done renaming" }).click();
    await expect(page.getByText("No classes yet.")).toBeVisible();

    await page.getByLabel("Timetable", { exact: true }).selectOption({ label: "Plan B" });
    await expect(week(page).getByRole("button", { name: /^Option A/ })).toHaveCount(1);
  });

  test("shows one day at a time on a phone, with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/timetable-maker");
    await addClass(page, {
      title: "Organic Chemistry",
      days: ["Monday"],
      start: "08:00",
      end: "09:30",
      room: "Lab 2",
    });

    await expect(week(page)).toBeHidden();
    const day = page.getByRole("region", { name: "Day view" });
    await day.getByRole("button", { name: /^Monday/ }).click();
    await expect(day.getByRole("button", { name: /Organic Chemistry/ })).toContainText("Lab 2");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("prints the week grid even from a phone", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/timetable-maker");
    await addClass(page, { title: "Printing", days: ["Monday"], start: "09:00", end: "10:00" });

    await page.emulateMedia({ media: "print" });
    await expect(week(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "Day view" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Add class" })).toBeHidden();
  });
});
