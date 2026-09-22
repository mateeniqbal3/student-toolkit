import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

/** On a phone an open note replaces the list; this goes back to it. */
async function showList(page: Page) {
  const back = page.getByRole("button", { name: "Notes", exact: true });
  if (await back.isVisible()) await back.click();
}

async function newNote(page: Page, title: string, body = "") {
  await showList(page);
  await page.getByRole("button", { name: "New note" }).click();
  const note = page.getByRole("article", { name: "Note" });
  await expect(note.getByLabel("Title")).toBeFocused();
  await note.getByLabel("Title").fill(title);
  if (body) await note.getByLabel("Note text").fill(body);
  await expect(note.getByText("Saved", { exact: true })).toBeVisible();
  return note;
}

function noteList(page: Page) {
  return page.getByRole("list", { name: "Notes" });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/notes");
});

test.describe("Notes", () => {
  test("writes Markdown with maths, previews it, and keeps it across a reload", async ({
    page,
  }) => {
    const note = await newNote(
      page,
      "Kinematics",
      "# Motion\n\nSpeed is $v = d/t$.\n\n- first\n- second",
    );
    await note.getByRole("button", { name: "Both" }).click();

    const preview = note.locator(".note-prose");
    await expect(preview.getByRole("heading", { name: "Motion" })).toBeVisible();
    await expect(preview.locator(".katex").first()).toBeVisible();
    await expect(preview.getByRole("listitem")).toHaveCount(2);

    await page.reload();
    await noteList(page)
      .getByRole("button", { name: /Kinematics/ })
      .click();
    await expect(page.getByLabel("Note text")).toHaveValue(/Speed is \$v = d\/t\$/);
  });

  test("shows HTML in a note as text instead of running it", async ({ page }) => {
    const note = await newNote(
      page,
      "Unsafe",
      '<img src=x onerror="document.title=1">\n\n<b>bold?</b>',
    );
    await note.getByRole("button", { name: "Preview" }).click();
    const preview = note.locator(".note-prose");
    await expect(preview).toContainText("<b>bold?</b>");
    await expect(preview.locator("img, b")).toHaveCount(0);
  });

  test("files notes in folders and tags, and filters by both", async ({ page }) => {
    await page.getByText("Folders", { exact: true }).click();
    await page.getByLabel("New folder").fill("Physics");
    await page.getByRole("button", { name: "Add folder" }).click();
    await expect(page.getByRole("list", { name: "Folders" })).toContainText("Physics");

    const waves = await newNote(page, "Waves");
    await waves.getByLabel("Folder").selectOption({ label: "Physics" });
    await waves.getByLabel("Tags").fill("#Exam, physics");
    await waves.getByLabel("Tags").press("Enter");
    await expect(waves.getByLabel("Tags")).toHaveValue("exam, physics");

    await newNote(page, "Shopping list");
    await showList(page);

    await page.getByLabel("Show").selectOption({ label: "Physics" });
    await expect(noteList(page)).toContainText("Waves");
    await expect(noteList(page)).not.toContainText("Shopping list");

    await page.getByLabel("Show").selectOption({ label: "All notes (2)" });
    await page
      .getByRole("group", { name: "Filter by tag" })
      .getByRole("button", { name: /#exam/ })
      .click();
    await expect(noteList(page).getByRole("listitem")).toHaveCount(1);
    await expect(noteList(page)).toContainText("Waves");
  });

  test("searches as you type, including partial words", async ({ page }) => {
    await newNote(page, "Photosynthesis", "Light reactions in the thylakoid.");
    await newNote(page, "Respiration", "Glycolysis then the Krebs cycle.");
    await showList(page);

    await page.getByLabel("Search notes").fill("thylak");
    await expect(noteList(page).getByRole("listitem")).toHaveCount(1);
    await expect(noteList(page)).toContainText("Photosynthesis");

    await page.getByLabel("Search notes").fill("nothing like this");
    await expect(page.getByText("No notes match “nothing like this”.")).toBeVisible();
  });

  test("moves a note to the trash, restores it, and deletes for good", async ({ page }) => {
    const note = await newNote(page, "Draft essay", "Some words.");
    await note.getByRole("button", { name: "Move to trash" }).click();
    await expect(noteList(page)).toHaveCount(0);

    await page.getByLabel("Show").selectOption({ label: "Trash (1)" });
    await noteList(page)
      .getByRole("button", { name: /Draft essay/ })
      .click();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("article", { name: "Note" }).getByLabel("Title")).toHaveValue(
      "Draft essay",
    );

    await page.getByRole("button", { name: "Move to trash" }).click();
    await noteList(page)
      .getByRole("button", { name: /Draft essay/ })
      .click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByText("The trash is empty.")).toBeVisible();
  });

  test("downloads a note as Markdown with front matter", async ({ page }) => {
    const note = await newNote(page, "Ohm's law", "V = IR");
    await note.getByLabel("Tags").fill("physics");
    await note.getByLabel("Tags").press("Enter");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      note.getByRole("button", { name: "Download as Markdown" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("ohm-s-law.md");
    const text = await readFile(await download.path(), "utf8");
    expect(text).toMatch(
      /^---\ntitle: "Ohm's law"\ntags: \["physics"\]\ncreated: .+\nupdated: .+\n---\n\nV = IR\n$/,
    );
  });

  test("imports Markdown files once, and round-trips a backup", async ({ page }) => {
    await page.getByText("Backup and import").click();
    const file = {
      name: "cells.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "---\ntitle: Cell structure\ntags: [biology]\n---\n\nNucleus and ribosomes.",
      ),
    };
    const input = page.getByLabel("Import a backup or Markdown files");
    await input.setInputFiles(file);
    await expect(page.getByText("Added 1 note.")).toBeVisible();
    await expect(noteList(page)).toContainText("Cell structure");

    await input.setInputFiles(file);
    await expect(page.getByText("Added 0 notes. 1 was already here.")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download backup" }).click(),
    ]);
    const backup = JSON.parse(await readFile(await download.path(), "utf8")) as {
      notes: { title: string; tags: string[] }[];
    };
    expect(backup.notes).toEqual([
      expect.objectContaining({ title: "Cell structure", tags: ["biology"] }),
    ]);
  });

  test("switches between list and note on a 360px screen with no horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await newNote(
      page,
      "Phone note",
      "$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6} + a + very + long + equation + that + keeps + going$$",
    );
    await expect(page.getByRole("button", { name: "New note" })).toBeHidden();
    await page.getByRole("button", { name: "Both" }).click();
    await expect(page.locator(".note-prose .katex-display")).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);

    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(noteList(page)).toContainText("Phone note");
  });
});
