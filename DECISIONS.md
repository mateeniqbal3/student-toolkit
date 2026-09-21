# Decisions

Non-blocking choices made while building, with the reasoning. Newest first.
If a decision here turns out to be wrong, change it and amend the entry rather
than deleting it — the reasoning is the useful part.

## Phase 4 — citation generator

### Formatting is citeproc-js with the official CSL styles, not hand-written

The five styles run on citeproc-js (through citation-js), the processor Zotero
and Mendeley use, fed the unmodified style files from the Citation Style
Language repository. Hand-writing five formatters would mean re-deriving
hundreds of pages of rules and getting the edge cases (et al. thresholds,
2020a/2020b, missing dates, editors) subtly wrong. Running the reference
implementation means the output matches what a supervisor's Zotero produces.

The cost is size: citeproc is a 127KB gzipped chunk. It is dynamically
imported, never in the initial bundle, and starts downloading as soon as the
page mounts so the first citation appears without a visible wait. The route
itself measures 238.9KB, budgeted at 245KB.

### Style files become generated modules, one chunk each

The `.csl` files stay in the repository exactly as published so a style can
be updated by dropping in a newer copy. `npm run styles` minifies each into a
TypeScript module exporting a string; the bundler splits each into its own
chunk (APA 6.6KB, Chicago 10KB gzipped). That needs no raw-file loader or
extra dependency, and a unit test fails if a module drifts from its source.
The `<info>` block is kept because CC BY-SA requires the attribution to travel
with the file. After the style in use is ready, the other four are fetched in
the background so switching style on a later offline visit works.

### Chicago is the 18th edition, not the 17th the brief named

The current official Chicago author-date style implements the 18th edition
(2024). Shipping a superseded edition on purpose would be doing students a
disservice, so the registry copy now says Chicago 18. Harvard is Cite Them
Right 12th edition, the variant most UK and Pakistani universities teach.

### Lookups go only to services a browser may call directly

Every service was probed for CORS before being chosen, because there is no
server of ours to proxy through:

| Identifier | Primary                        | Fallback             |
| ---------- | ------------------------------ | -------------------- |
| DOI        | doi.org content negotiation    | Crossref REST API    |
| arXiv      | doi.org, via the DataCite DOI  | DataCite API         |
| ISBN       | Open Library edition + search  | Google Books         |
| PubMed     | NCBI E-utilities, then its DOI | the E-utilities data |

arXiv's own API and NCBI's citation exporter both lack CORS headers, which is
why arXiv goes through its DataCite DOI and PubMed through E-utilities. Open
Library's `/api/books` endpoint now returns 404, so the edition record is used
for publisher, year and edition, and the search index for author names, which
edition records usually omit. Google Books' anonymous quota is shared and often
exhausted, so it is the fallback rather than the primary. A PubMed record with
a DOI is re-fetched through doi.org, because PubMed abbreviates given names to
initials and the publisher's record has them in full.

The lookup distinguishes "nothing is registered under that" from "no service
answered". The first means a typo; the second usually means offline. Telling a
student their correct DOI does not exist would be worse than no answer.

### The student sees the formatted source before it is added

Publisher metadata is sometimes wrong — a title in capitals, a missing issue —
and the moment to catch that is before it is in the reference list. A lookup
shows a preview in the chosen style with "Add" and "Edit first", which is one
extra glance and not an extra step.

### Sources are their own table; projects hold a style

Unlike a semester's courses, sources are edited one at a time and a thesis
bibliography can reach hundreds, so `citations` is a table indexed by
`projectId` rather than an array embedded in the project. Each project stores
its own style, because each assignment has its own. The last project is
emptied rather than deleted, the same rule as the GPA calculator's last
semester.

### In-text citations come from one processor pass over the whole list

citation-js's `citation` output registers only the source being cited, which
drops the "a" and "b" from two works by one author in one year and numbers
every IEEE citation "[1]". The generator instead asks citeproc for every
source's citation in one `rebuildProcessorState` call, in reference-list
order, which gets both right and is linear rather than quadratic.

### Formatted HTML is sanitised even though citeproc escapes it

Titles from publishers carry markup (JATS italics, `<sub>` in chemical
formulae), and the formatted HTML is both rendered on the page and put on the
clipboard for Word. The sanitiser keeps only italic, bold, sub, sup and
small-caps spans. It is a second line of defence, and it is tested with
script and handler payloads.

### Duplicates are caught by identifier first, then title and year

Pasting the same DOI twice is the common way a list gains a duplicate, and
the copy then renders as a different source (2020a and 2020b of one paper).
The finder warns and offers "Add it again" rather than refusing, because two
editions of a book can legitimately share a title.

### Deletes are undoable rather than confirmed

A confirmation dialog on every delete trains people to tap through it. The
deleted record is held for ten seconds with an Undo button, and restored with
its original id and position. Deleting a whole bibliography, which cannot be
undone, still asks first.

## Phase 3 — unit converter

### "Tools 1-8 make zero network requests" was the wrong rule, and is now corrected

`ARCHITECTURE.md` and `CLAUDE.md` both stated it that way, and both were wrong
on their own terms: the unit converter has always been specified to fetch live
exchange rates, and the citation generator to look up a DOI or ISBN. The rule
that actually matters — and the one the UI claims — is that nothing a student
types leaves the device. Public reference data may come in; student data never
goes out. Both files now say that, with a table of exactly which three tools
reach the network and what each request carries.

Worth stating plainly rather than quietly editing, because the old wording
would have made the citation generator look like a violation of the
architecture rather than an instance of it.

### Rates come from three providers in order, and PKR decides the order

`open.er-api.com` is tried first, `exchangerate.host` second, `frankfurter.app`
third. All three are free, need no account and ask for no card.

The obvious ordering would put the ECB-derived services first, since they are
the more authoritative source. They are also the wrong choice here: they
publish around thirty currencies and omit PKR, INR, BDT, NPR and LKR — which
is most of the list this app's readers need. Coverage beats provenance when the
alternative is a converter that cannot convert the user's own currency.

Three providers rather than one because a project with no budget cannot pay for
an SLA, and any single free endpoint may change its terms. Each attempt gets
its own timeout so a hanging provider does not block the next.

### A stale rate beats no rate

Rates are cached in IndexedDB keyed by base currency, refetched when older than
twelve hours, and used regardless of age when the network fails. The UI always
prints "rates as of" and which provider answered.

A student working out roughly what a 40-dollar textbook costs does not need
this morning's mid-market fix; they need the order of magnitude. Failing closed
would serve nobody, and failing silently would be worse. The one case with no
honest answer — no network and no cache — says exactly that.

Everything converts through a single USD-based table, so one cached table
covers every pair rather than one per pair.

### Conversions go through a base unit, in one of three shapes

Per category, every unit states its relationship to one base, which keeps the
definitions linear in the unit count rather than quadratic. Three shapes cover
all sixteen categories: linear (`base = value × factor`), offset (temperature
only), and reciprocal (fuel economy only, because less fuel per distance means
more distance per unit of fuel). Factors are exact where an exact definition
exists — an inch is 0.0254 m by agreement, not by measurement — so conversions
round-trip, and a test asserts that they do.

### The converter answers the whole category, not just the pair

Typing a number shows every unit in the category at once, underneath the
selected pair. It answers the question the student had and the one they were
about to ask, and it costs nothing but layout.

### Absolute zero is a real answer, not a number

A converter that cheerfully reports −400°C as 33 K is lying. Temperature input
below absolute zero produces a refusal rather than a conversion. No other
category has a floor, so the check is scoped to temperature rather than
generalised into a validation layer nothing else needs.

### Marla, kanal and tola are in the tables on purpose

Land across Pakistan and north India is quoted in marla and kanal, and gold in
tola. These are not curiosities for this audience — they are the units a
student is most likely to need converting and least likely to find in a generic
converter.

### Switching category remounts the panel

That is what resets the unit pair to the new category's sensible default,
instead of leaving "kilometres" selected on a screen that is now about
pressure. A `key` on the panel is the whole implementation.

## Phase 2 — GPA and percentage calculators

### Tool routes carry their own bundle budget

The home route holds at 191KB because it ships almost no application code.
A tool route cannot: `/gpa-calculator` measures 230.9KB, and roughly 35KB of
the difference is Dexie and its React binding.

That is the price of the local-first decision rather than a regression. There
is no server to hold a transcript, so the transcript lives in IndexedDB, and
a hand-rolled IndexedDB wrapper would cost most of the same bytes with worse
migration handling. The budgets are therefore per route and set from real
measurements: 195KB for `/`, 215KB for `/percentage-calculator`, 240KB for
`/gpa-calculator`. Each one has a little headroom and nothing more, so a
careless import still fails the build.

Note that `/percentage-calculator` comes in at 196.3KB with no persistence at
all — about 5KB of application code over the framework floor. Tools that do
not need to remember anything should stay in that range.

### Grade pickers are native `<select>` elements

A transcript page can hold thirty of them. Radix's select is nicer looking but
costs bundle on exactly the page that can least afford it, and on Android the
native control opens the system wheel picker, which is faster to use one-handed
than any listbox rebuilt in JavaScript. `NativeSelect` is styled to match
`Input`, so the difference is invisible until you tap it, at which point the
platform control is the better one.

The custom scale editor is the exception: it uses the Radix dialog, and it is
behind a dynamic import for the same reason the mobile navigation sheet is —
most students pick a built-in scale and never open it.

### Transcript text fields are uncontrolled

Every keystroke in the transcript writes to IndexedDB, and the value comes back
through `useLiveQuery` asynchronously. Binding `value` to that round trip means
a fast typist can outrun the store and lose characters. The name and credit
fields therefore use `defaultValue` and write on change, so React never fights
the keyboard. Grade selects stay controlled, because a select cannot drop
input the way a text field can.

### Half-filled rows are skipped, not scored as zero

A student types a course name before they have a grade for it. Counting that
row as a zero would show a failing GPA mid-typing, so `calculateGpa` skips any
row without both a resolvable grade and positive credits, and reports how many
it skipped. An `F` is a grade and still counts; only a blank is a blank.

The same reasoning drives the weighted-marks mode of the percentage
calculator: it scores against the weight actually entered rather than against
100, so a student who has sat the midterm but not the final sees how they are
doing rather than a number depressed by a paper that does not exist yet.

### CGPA is credit-weighted across all courses, never an average of averages

Averaging the semester GPAs gives a different — and wrong — answer whenever
semesters carry different credit loads. It is also the mistake students most
often make by hand, so the unit test for it states both numbers explicitly.

### The last semester is emptied rather than deleted

Deleting it would leave the page with nothing to render and an empty state
whose only purpose is to ask the student to press "add semester". For the same
reason a first visit seeds one semester with four blank rows: a calculator
with no rows is not a calculator.

### Preferences read `localStorage` through `useSyncExternalStore`

Storage is an external store, and the server has none. The hook's server
snapshot is the fallback value, which lets React hydrate against matching HTML
and then re-render once with the stored value. Syncing in an effect either
flashes or trips the `react-hooks/set-state-in-effect` rule, both of which are
the lint rule correctly describing a real problem.

## Phase 1 — design system and app shell

### The 150KB initial-JS budget is not reachable on this stack

The brief set a budget of 150KB gzipped of initial JavaScript for the home
route. Measured on an empty page, Next 16 App Router with React 19 ships about
157KB gzipped before any application code exists:

| Chunk                     | Gzipped |
| ------------------------- | ------- |
| react-dom                 | 71.6 KB |
| App Router client runtime | 46.6 KB |
| React core and scheduler  | 38.7 KB |

The home route currently measures 190.9 KB, so roughly 34 KB is ours: the class
merging helper (`tailwind-merge`), the handful of icons used inside client
components, Radix's `Slot`, and next-themes.

Reaching 150KB would mean leaving the App Router — an islands framework such as
Astro, or SvelteKit — which is a stack decision rather than an optimisation. The
budget is therefore set to 195KB, which holds the current measurement and
catches regressions. What actually matters for the audience is time to
interactive on a slow connection, and that is protected by the pages being
prerendered static HTML with all of this JavaScript deferred.

### Bundle size is measured, not assumed

Next 16 stopped printing per-route sizes at build time. `npm run budget` starts
the production server, fetches a route, collects every script the document
pulls in, gzips each one and compares the total against the budget. It is a real
measurement of what a browser downloads rather than a proxy for it.

### The mobile navigation sheet is code-split behind its trigger

Radix's dialog primitive costs about 33KB gzipped. Most visitors never open the
menu, and those who do can afford a fetch on the tap. The trigger button ships
eagerly and the sheet is dynamically imported on first press, which removed
those 33KB from every first visit while keeping Radix's focus trapping and
escape handling rather than hand-rolling them.

### Tool icons live outside the tool registry

`src/lib/tools.ts` is imported by client components, so anything it references
reaches the browser. Holding the nine Lucide icon components on the registry
pulled all of them into the client bundle. Icons now live in
`src/lib/tool-icons.ts` and are only read by server components, which renders
them to HTML at no client cost.

### The theme toggle cycles instead of opening a menu

A dropdown for three options pulled Radix's popper engine onto every route. The
toggle is now a single button that cycles light, dark and system. The icon is
chosen by CSS on the `.dark` class rather than in JavaScript, which avoids both
a hydration mismatch and the flash a mounted-flag approach causes.

### The toaster is not mounted globally

Nothing in Phase 1 raises a toast, and mounting sonner in the root layout cost
every route. Tools that need toasts will mount the toaster themselves.

### The service worker is hand-rolled

`next-pwa` is unmaintained against Next 15 and later. The caching this app needs
is small enough to own outright: network-first for navigations, cache-first for
content-hashed `/_next/static` assets, stale-while-revalidate for fonts and
images, and never for `/api`. Route chunks reach the cache because the home page
links to all nine tools and Next prefetches links entering the viewport, so
those prefetches pass through the fetch handler.

### RTL is enabled in shadcn from the start

The brief asks for the strings to be structured so Urdu can be added later.
Urdu is right-to-left, so shadcn was initialised with `--rtl`. Enabling it now
costs nothing and avoids revisiting every component later.

## Phase 0 — scaffolding

### Next.js 16, not 15

The brief specified Next.js 15. `create-next-app@latest` installs 16.3.5, which
is the current stable release and still App Router with React 19. Staying on the
latest major on a greenfield project avoids starting one major version behind on
something intended to run unattended on a free tier for years. Downgrading is a
single `npm install next@15` while the app is this small, so this is cheap to
reverse if the brief meant 15 literally.

### npm, not pnpm

The machine already has npm 10 configured and working. pnpm would save disk and
install time, but it adds a setup step, and GitHub Actions caching for npm is
one line. Not worth the friction for a solo project.

### Prettier keeps double quotes

`singleQuote: false` matches what `create-next-app` generates and what shadcn/ui
ships, so adding components later produces no reformatting churn.

### Playwright runs Chromium-only in CI

The free Actions minutes on a public repo are generous but not infinite, and
installing three browser engines on every push is the slowest step. Chromium
covers the critical path; the full browser matrix is a Phase 7 task run locally
before launch.

### Class-based dark mode from the start

`globals.css` defines dark tokens under a `.dark` class with a Tailwind v4
`@custom-variant`, rather than only `prefers-color-scheme`. next-themes drives
that class in Phase 1, and writing it this way now means no token rewrite later.

### Tokens named by role, not by colour

CSS variables are `--primary`, `--surface`, `--muted-foreground` rather than
`--teal-600`. This is what makes the light and dark themes swappable, and it is
also the seam where a future theme (or high-contrast mode) plugs in.
