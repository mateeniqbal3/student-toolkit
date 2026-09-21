# Decisions

Non-blocking choices made while building, with the reasoning. Newest first.
If a decision here turns out to be wrong, change it and amend the entry rather
than deleting it — the reasoning is the useful part.

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
