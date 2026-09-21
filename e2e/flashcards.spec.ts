import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

async function createDeck(page: Page, name: string) {
  await page.goto("/flashcards");
  await page.getByLabel("New deck").fill(name);
  await page.getByRole("button", { name: "Create deck" }).click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
}

async function addCard(page: Page, front: string, back: string) {
  const form = page.getByRole("region", { name: "Add a card" });
  await form.getByLabel("Front").fill(front);
  await form.getByLabel("Back").fill(back);
  await form.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByRole("region", { name: /^Cards/ })).toContainText(front);
}

function cardsList(page: Page) {
  return page.getByRole("region", { name: /^Cards/ });
}

test.describe("Flashcards", () => {
  test("creates a deck and adds cards to it", async ({ page }) => {
    await createDeck(page, "Cell biology");
    await addCard(page, "What is ATP?", "The cell's energy currency");
    await addCard(page, "Organelle for respiration", "Mitochondrion");

    await expect(cardsList(page)).toContainText("Cards (2)");
    await expect(page.getByText("New 2")).toBeVisible();
    // The form clears and returns to the front for the next card.
    await expect(page.getByRole("region", { name: "Add a card" }).getByLabel("Front")).toHaveValue(
      "",
    );
  });

  test("studies a card through learning to graduation, showing each button's interval", async ({
    page,
  }) => {
    await createDeck(page, "Physics");
    await addCard(page, "F = ?", "ma");
    await page.getByRole("button", { name: "Study now" }).click();

    const card = page.getByRole("region", { name: "Flashcard" });
    await expect(card).toContainText("F = ?");
    await expect(card).not.toContainText("ma");

    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(card).toContainText("ma");

    const buttons = page.getByRole("group", { name: "How well did you remember it?" });
    await expect(buttons.getByRole("button", { name: /Again/ })).toContainText("1m");
    await expect(buttons.getByRole("button", { name: /Hard/ })).toContainText("6m");
    await expect(buttons.getByRole("button", { name: /Good/ })).toContainText("10m");
    await expect(buttons.getByRole("button", { name: /Easy/ })).toContainText("4d");

    // Good moves it to the ten-minute step, which comes back early rather than
    // making the student wait; a second Good graduates it.
    await buttons.getByRole("button", { name: /Good/ }).click();
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(buttons.getByRole("button", { name: /Good/ })).toContainText("1d");
    await buttons.getByRole("button", { name: /Good/ }).click();

    await expect(page.getByRole("region", { name: "Session finished" })).toContainText(
      "Done for today",
    );
  });

  test("works from the keyboard, and undoes the last answer", async ({ page }) => {
    await createDeck(page, "Keyboard");
    await addCard(page, "Capital of Pakistan", "Islamabad");
    await page.getByRole("button", { name: "Study now" }).click();

    const card = page.getByRole("region", { name: "Flashcard" });
    await page.keyboard.press("Space");
    await expect(card).toContainText("Islamabad");
    await page.keyboard.press("4");
    await expect(page.getByRole("region", { name: "Session finished" })).toBeVisible();

    await page.getByRole("button", { name: "Undo last answer" }).click();
    await expect(card).toContainText("Capital of Pakistan");
    await expect(page.getByText("New 1")).toBeVisible();
  });

  test("stops introducing new cards at the daily limit", async ({ page }) => {
    await createDeck(page, "Limited");
    await addCard(page, "one", "1");
    await addCard(page, "two", "2");

    await page.getByText("Deck settings").click();
    await page.getByLabel("New cards a day").fill("1");
    await expect(page.getByText("New 1")).toBeVisible();

    await page.getByRole("button", { name: "Study now" }).click();
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: /Easy/ }).click();
    await expect(page.getByRole("region", { name: "Session finished" })).toContainText(
      "Done for today",
    );
  });

  test("keeps decks and progress across a reload", async ({ page }) => {
    await createDeck(page, "Persistent");
    await addCard(page, "Kept?", "Yes");
    await page.getByRole("button", { name: "Study now" }).click();
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: /Easy/ }).click();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Persistent", level: 3 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Study Persistent" })).toBeDisabled();
    await page.getByRole("button", { name: "Open Persistent" }).click();
    await expect(cardsList(page)).toContainText("4d");
  });

  test("imports pasted cards, reporting lines it cannot use", async ({ page }) => {
    await createDeck(page, "Imported");
    await page.getByText("Import cards").click();
    await page
      .getByLabel("Cards to import")
      .fill(
        "#separator:tab\nosmosis\twater crossing a membrane\nno back here\nmeiosis\tfour haploid cells",
      );

    await expect(page.getByRole("status").filter({ hasText: "Found" })).toContainText(
      "Found 2 cards, separated by tabs. 1 line has no back and will be skipped.",
    );
    await page.getByRole("button", { name: "Add 2 cards" }).click();
    await expect(cardsList(page)).toContainText("Cards (2)");
    await expect(cardsList(page)).toContainText("four haploid cells");
  });

  test("exports a deck Anki can import", async ({ page }) => {
    await createDeck(page, "Export me");
    await addCard(page, "Front, with comma", "Back");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Anki" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("export-me.txt");
    const text = await readFile(await download.path(), "utf8");
    expect(text).toBe("#separator:tab\n#html:false\nFront, with comma\tBack\n");
  });

  test("edits a card, and deletes one with undo", async ({ page }) => {
    await createDeck(page, "Editing");
    await addCard(page, "Speed of light", "300,000 km/h");

    await page.getByRole("button", { name: "Edit card Speed of light" }).click();
    await cardsList(page).getByLabel("Back").fill("300,000 km/s");
    await page.getByRole("button", { name: "Save card" }).click();
    await expect(cardsList(page)).toContainText("300,000 km/s");

    await page.getByRole("button", { name: "Delete card Speed of light" }).click();
    await expect(cardsList(page)).toContainText("Cards (0)");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(cardsList(page)).toContainText("Cards (1)");
  });

  test("studies on a 360px screen with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await createDeck(page, "Phone");
    await addCard(
      page,
      "A long front that should wrap rather than overflow the screen width",
      "ok",
    );
    await page.getByRole("button", { name: "Study now" }).click();
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.getByRole("button", { name: /Good/ })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
