import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The assistant talks straight to Google from the browser, so these tests
 * stand in for Google: no key and no connection are needed to run them, and
 * they can produce failures (a refused key, a busy server) on demand.
 */

const STREAM = "**/generativelanguage.googleapis.com/**:streamGenerateContent*";
const MODELS = "**/generativelanguage.googleapis.com/**/models?pageSize=1*";

function sseBody(...pieces: string[]): string {
  return pieces
    .map(
      (text) =>
        `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }], role: "model" } }] })}\n\n`,
    )
    .join("");
}

async function fulfilStream(route: Route, ...pieces: string[]) {
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream" },
    body: sseBody(...pieces),
  });
}

/** Accepts any key, and answers every question with the given text. */
async function stubGoogle(page: Page, ...pieces: string[]) {
  await page.route(MODELS, (route) => route.fulfill({ status: 200, body: "{}" }));
  await page.route(STREAM, (route) => fulfilStream(route, ...pieces));
}

async function addKey(page: Page, key = "test-key") {
  await page.getByLabel("Gemini API key").fill(key);
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByLabel("Message to the assistant")).toBeVisible();
}

async function ask(page: Page, question: string) {
  await page.getByLabel("Message to the assistant").fill(question);
  await page.getByRole("button", { name: "Send" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/ai-assistant");
});

test.describe("AI assistant", () => {
  test("asks for a key first, and says where to get one", async ({ page }) => {
    const gate = page.getByRole("region", { name: "Add your API key" });
    await expect(gate).toBeVisible();
    await expect(gate.getByRole("link", { name: /aistudio\.google\.com\/apikey/ })).toHaveAttribute(
      "href",
      "https://aistudio.google.com/apikey",
    );
    await expect(gate).toContainText("stays in this browser");
    // Nothing to type into until a key is saved.
    await expect(page.getByLabel("Message to the assistant")).toBeHidden();
  });

  test("checks the key before saving it, and keeps it for next time", async ({ page }) => {
    await page.route(MODELS, (route) =>
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: { message: "API key not valid" } }),
      }),
    );
    await page.getByLabel("Gemini API key").fill("wrong");
    await page.getByRole("button", { name: "Save key" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "did not accept that key" }),
    ).toBeVisible();
    await expect(page.getByLabel("Message to the assistant")).toBeHidden();

    await stubGoogle(page, "Hello");
    await addKey(page, "good-key");

    await page.reload();
    await expect(page.getByLabel("Message to the assistant")).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("toolkit:ai:key"));
    expect(stored).toBe("good-key");
  });

  test("streams an answer, keeps it after a reload, and starts a new chat", async ({ page }) => {
    await stubGoogle(page, "A p-value is ", "the probability of…");
    await addKey(page);
    await ask(page, "What is a p-value?");

    const answer = page.getByRole("article", { name: "Assistant" });
    await expect(answer).toContainText("A p-value is the probability of…");
    await expect(page.getByRole("button", { name: "Ask again" })).toBeVisible();

    await page.reload();
    await page.getByText(/Earlier chats \(1\)/).click();
    await page.getByRole("list", { name: "Earlier chats" }).getByRole("button").first().click();
    await expect(page.getByRole("article", { name: "Assistant" })).toContainText("A p-value is");

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByRole("article", { name: "Assistant" })).toHaveCount(0);
  });

  test("sends the mode's instructions and the whole conversation", async ({ page }) => {
    const bodies: string[] = [];
    await page.route(MODELS, (route) => route.fulfill({ status: 200, body: "{}" }));
    await page.route(STREAM, async (route) => {
      bodies.push(route.request().postData() ?? "");
      await fulfilStream(route, "Step one…");
    });

    await addKey(page);
    await page.getByRole("button", { name: "Step by step" }).click();
    await ask(page, "Solve 2x + 3 = 9");
    await expect(page.getByRole("button", { name: "Ask again" })).toBeVisible();
    await ask(page, "Why is that step needed?");
    await expect(page.getByRole("article", { name: "Assistant" })).toHaveCount(2);

    const first = JSON.parse(bodies[0] ?? "{}") as {
      systemInstruction: { parts: { text: string }[] };
      generationConfig: { thinkingConfig: { thinkingBudget: number } };
    };
    expect(first.systemInstruction.parts[0]?.text).toContain("one step at a time");
    // The one mode that lets the model think before answering.
    expect(first.generationConfig.thinkingConfig.thinkingBudget).toBeGreaterThan(0);

    const second = JSON.parse(bodies[1] ?? "{}") as {
      contents: { role: string; parts: { text: string }[] }[];
    };
    expect(second.contents.map((turn) => turn.role)).toEqual(["user", "model", "user"]);
    expect(second.contents[2]?.parts[0]?.text).toBe("Why is that step needed?");
  });

  test("turns generated flashcards into a deck", async ({ page }) => {
    await stubGoogle(
      page,
      '[{"front":"What happens in prophase?","back":"Chromatin condenses"},',
      '{"front":"What happens in telophase?","back":"Nuclear envelopes re-form"}]',
    );
    await addKey(page);
    await page.getByRole("button", { name: "Flashcards" }).click();
    await ask(page, "Make flashcards on mitosis");

    // Shown as cards, not as the JSON the model was asked for.
    const cards = page.getByRole("list", { name: "Generated flashcards" });
    await expect(cards.getByRole("listitem")).toHaveCount(2);
    await expect(cards).not.toContainText("front");

    const panel = page.getByRole("region", { name: "Save these flashcards" });
    await panel.getByLabel("Deck name").fill("Mitosis");
    await panel.getByRole("button", { name: "Add 2 cards" }).click();
    await expect(page.getByText("Added 2 cards.")).toBeVisible();

    await page.goto("/flashcards");
    await expect(page.getByRole("heading", { name: "Mitosis", level: 3 })).toBeVisible();
    await expect(page.getByText("2 cards")).toBeVisible();
  });

  test("explains what went wrong, and retries when Google is busy", async ({ page }) => {
    await page.route(MODELS, (route) => route.fulfill({ status: 200, body: "{}" }));
    let attempts = 0;
    await page.route(STREAM, async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, body: "{}" });
        return;
      }
      await fulfilStream(route, "Second time lucky");
    });

    await addKey(page);
    await ask(page, "Explain osmosis");
    await expect(page.getByRole("article", { name: "Assistant" })).toContainText(
      "Second time lucky",
    );
    expect(attempts).toBe(2);

    await page.unroute(STREAM);
    await page.route(STREAM, (route) =>
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: { message: "Quota exceeded" } }),
      }),
    );
    await ask(page, "Again please");
    const alert = page.getByRole("alert").filter({ hasText: "free limit" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Quota exceeded");
  });

  test("can stop an answer that is taking too long", async ({ page }) => {
    await page.route(MODELS, (route) => route.fulfill({ status: 200, body: "{}" }));
    // A request that never answers, so Stop is the only way out of it.
    const hanging = new Promise<void>(() => {});
    await page.route(STREAM, async () => {
      await hanging;
    });
    await addKey(page);

    await ask(page, "Write a very long essay");
    const stop = page.getByRole("button", { name: "Stop" });
    await expect(stop).toBeVisible();
    await expect(page.getByText("Thinking…")).toBeVisible();

    await stop.click();
    // Back to a usable composer, and stopping is not an error.
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(1);
    await expect(page.getByText("Thinking…")).toBeHidden();
  });

  test("removing the key returns to the key prompt", async ({ page }) => {
    await stubGoogle(page, "Hi");
    await addKey(page);
    await page.getByText("Assistant settings").click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Remove key" }).click();
    await expect(page.getByRole("region", { name: "Add your API key" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("toolkit:ai:key"))).toBe("");
  });

  test("works on a 360px screen with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await stubGoogle(page, "$E = mc^2$ is the mass-energy equivalence.");
    await addKey(page);
    await ask(page, "Explain E = mc^2");
    await expect(page.getByRole("article", { name: "Assistant" })).toContainText("equivalence");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
