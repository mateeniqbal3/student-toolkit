import { expect, test, type Page } from "@playwright/test";

const LOOKUP_HOSTS =
  /doi\.org|api\.crossref\.org|api\.datacite\.org|openlibrary\.org|googleapis\.com|eutils\.ncbi\.nlm\.nih\.gov/;

const ARTICLE_CSL = {
  type: "journal-article",
  title: "Measured measurement",
  author: [{ given: "Markus", family: "Aspelmeyer" }],
  issued: { "date-parts": [[2009, 1]] },
  "container-title": "Nature Physics",
  volume: "5",
  issue: "1",
  page: "11-12",
  DOI: "10.1038/nphys1170",
};

/** Answers doi.org with the article, and refuses every other lookup host. */
async function mockLookups(page: Page) {
  await page.route(LOOKUP_HOSTS, (route) =>
    new URL(route.request().url()).hostname === "doi.org"
      ? route.fulfill({ json: ARTICLE_CSL })
      : route.abort(),
  );
}

function references(page: Page) {
  return page.getByRole("region", { name: /References/ });
}

async function findAndAdd(page: Page, identifier: string) {
  await page.getByLabel("Find a source").fill(identifier);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const found = page.getByRole("region", { name: "Source found" });
  await expect(found).toContainText("Measured measurement");
  await found.getByRole("button", { name: "Add to bibliography" }).click();
}

test.describe("Citation generator", () => {
  test("fills a source in from a DOI and formats it in APA", async ({ page }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");

    const requests: string[] = [];
    page.on("request", (request) => {
      if (LOOKUP_HOSTS.test(request.url())) requests.push(request.url());
    });

    await findAndAdd(page, "https://doi.org/10.1038/nphys1170");

    const list = references(page);
    await expect(list).toContainText(
      "Aspelmeyer, M. (2009). Measured measurement. Nature Physics, 5(1), 11–12.",
    );
    await expect(list).toContainText("(Aspelmeyer, 2009)");
    // The only thing that left the page was the identifier itself.
    expect(requests).toEqual(["https://doi.org/10.1038/nphys1170"]);
  });

  test("keeps the bibliography across a reload and re-renders it in another style", async ({
    page,
  }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");
    await expect(references(page)).toContainText("Aspelmeyer, M. (2009)");

    await page.reload();
    await expect(references(page)).toContainText("Aspelmeyer, M. (2009)");

    await page.getByLabel("Citation style").selectOption("ieee");
    await expect(references(page)).toContainText("[1] M. Aspelmeyer, “Measured measurement,”");

    await page.reload();
    await expect(page.getByLabel("Citation style")).toHaveValue("ieee");
  });

  test("warns before adding the same source twice", async ({ page }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");

    await page.getByLabel("Find a source").fill("10.1038/nphys1170");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    const found = page.getByRole("region", { name: "Source found" });
    await found.getByRole("button", { name: "Add to bibliography" }).click();

    await expect(found).toContainText("already in this bibliography");
    await expect(references(page)).toContainText("References (1)");
  });

  test("builds a source typed in by hand", async ({ page }) => {
    await page.goto("/citation-generator");
    await page.getByRole("button", { name: "Type a source in by hand" }).click();

    const form = page.getByRole("region", { name: "New source" });
    await form.getByLabel("Source type").selectOption("book");
    await form.getByLabel("Book title").fill("Introduction to algorithms");
    await form.getByLabel("Author 1 first names").fill("Thomas H.");
    await form.getByLabel("Author 1 last name").fill("Cormen");
    await form.getByLabel("Date published: year").fill("2009");
    await form.getByLabel("Edition").fill("3");
    await form.getByLabel("Publisher").fill("MIT Press");
    await form.getByRole("button", { name: "Add to bibliography" }).click();

    await expect(form).toBeHidden();
    await expect(references(page)).toContainText(
      "Cormen, T. H. (2009). Introduction to algorithms (3rd ed.). MIT Press.",
    );
  });

  test("refuses to save a source with no title", async ({ page }) => {
    await page.goto("/citation-generator");
    await page.getByRole("button", { name: "Type a source in by hand" }).click();

    const form = page.getByRole("region", { name: "New source" });
    await form.getByRole("button", { name: "Add to bibliography" }).click();
    await expect(form.getByText("A title is needed.")).toBeVisible();
  });

  test("edits a saved source", async ({ page }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");

    await references(page).getByRole("button", { name: "Edit reference" }).click();
    const form = page.getByRole("region", { name: "Edit source" });
    await form.getByLabel("Article title").fill("Measured measurement, revisited");
    await form.getByRole("button", { name: "Save changes" }).click();

    await expect(references(page)).toContainText("Measured measurement, revisited");
  });

  test("deletes a source and can put it back", async ({ page }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");

    await references(page).getByRole("button", { name: "Delete reference" }).click();
    await expect(references(page)).toContainText("References (0)");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(references(page)).toContainText("References (1)");
  });

  test("says plainly when an identifier is not registered", async ({ page }) => {
    await page.route(LOOKUP_HOSTS, (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/citation-generator");

    await page.getByLabel("Find a source").fill("10.9999/does-not-exist");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page.getByText(/Nothing is registered under that DOI/)).toBeVisible();
  });

  test("says it may be offline, rather than not found, when no service answers", async ({
    page,
  }) => {
    await page.route(LOOKUP_HOSTS, (route) => route.abort());
    await page.goto("/citation-generator");

    await page.getByLabel("Find a source").fill("978-0-262-03384-8");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page.getByText(/you may be offline/)).toBeVisible();
  });

  test("catches a mistyped ISBN without a network request", async ({ page }) => {
    await page.goto("/citation-generator");
    let requested = false;
    page.on("request", (request) => {
      if (LOOKUP_HOSTS.test(request.url())) requested = true;
    });

    await page.getByLabel("Find a source").fill("978-0-262-03384-9");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page.getByText(/check digit does not match/)).toBeVisible();
    expect(requested).toBe(false);
  });

  test("exports BibTeX named after the bibliography", async ({ page }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");
    await expect(references(page)).toContainText("Aspelmeyer");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "BibTeX" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("my-bibliography.bib");
  });

  test("keeps separate bibliographies apart", async ({ page }) => {
    await mockLookups(page);
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");
    await expect(references(page)).toContainText("References (1)");

    await page.getByRole("button", { name: "New bibliography" }).click();
    await page.getByLabel("Bibliography", { exact: true }).fill("Thesis chapter 2");
    await page.getByRole("button", { name: "Done renaming" }).click();

    await expect(references(page)).toContainText("References (0)");
    await page
      .getByLabel("Bibliography", { exact: true })
      .selectOption({ label: "My bibliography" });
    await expect(references(page)).toContainText("References (1)");
  });

  test("fits a 360px screen", async ({ page }) => {
    await mockLookups(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/citation-generator");
    await findAndAdd(page, "10.1038/nphys1170");
    await expect(references(page)).toContainText("Aspelmeyer");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
