# Working in this repo

Read this before changing anything. `ARCHITECTURE.md` has the data models and
module boundaries; this file is about how to work here.

## Environment

This project lives at `~/projects/student-toolkit` **inside WSL2 Ubuntu**, not on
the Windows filesystem. Never move it to `/mnt/c` or any drive mount: Node file
watchers across the 9p mount are slow enough to break the dev server experience
and can miss change events entirely. All commands run WSL-native.

## The constraint everything else follows from

**Nothing a student types may leave the device, and every tool except the AI assistant uses zero server
storage and zero server compute of ours.** The budget for this project is zero
dollars, permanently. Local-first is what makes that possible: no server
compute, no database, nothing to bill. It is also what makes the app work
offline and what lets the UI honestly claim that student data never leaves the
device.

Two of those tools do fetch public reference data — exchange rates for the unit
converter, citation metadata for a pasted DOI or ISBN — over anonymous requests
that carry no user input beyond a public identifier, and both fall back to
cached or manual entry when offline. That is the line: public data may come in,
student data never goes out.

Before adding any dependency or service, check that it is free with no credit
card and stays free at moderate traffic. Prefer removing the need for a service
over fitting inside its free quota.

## Commands

```bash
npm run dev           # dev server
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run format        # prettier --write .
npm run test          # vitest run
npm run test:watch    # vitest
npm run build         # next build
npm run budget        # measure gzipped JS per route against the budget
npm run e2e           # playwright (needs a build first)
npm run icons         # regenerate the PWA icons from scripts/generate-icons.mjs
npm run styles        # regenerate citation style modules after replacing a .csl file
```

CI runs typecheck, lint, format:check, test, build, then the Playwright smoke
suite. All of it must pass before merge.

## Conventions

- **TypeScript is strict.** No `any`, no non-null `!` to silence the compiler.
  If a type is awkward, the model is usually wrong.
- **Pure logic goes in `src/lib/<domain>/` and imports no React.** Grading
  scales, unit conversion tables, citation formatting, percentage maths. This is
  where the unit tests point, and it keeps computation out of render paths.
- **Heavy libraries are dynamically imported.** `pdf-lib`, `pdf.js`, and
  `citation-js` must never land in the initial bundle. Run `npm run budget`
  after a build: it measures the real gzipped JavaScript per route and fails
  over the limit. CI runs it too. Note that anything imported by a client
  component reaches the browser even if only a server component renders it,
  which is why tool icons live in `src/lib/tool-icons.ts` rather than on the
  registry in `src/lib/tools.ts`.
- **Every tool gets its own indexable route** (`/gpa-calculator`,
  `/citation-generator`, and so on) with its own metadata. That is how students
  find this on Google, so it is a feature, not a routing detail.
- **Strings are structured for translation** but not translated yet. Urdu is a
  later addition; do not hardcode user-facing English inside logic modules.
- **Colours come from role tokens** (`--primary`, `--surface`,
  `--muted-foreground`), never raw hex in components. That is what keeps light
  and dark themes in sync.
- **Mobile-first, tested at 360px.** No horizontal scroll, thumb-reachable
  controls.
- **Conventional Commits**, small and logical. Branch per phase, PR into `main`,
  squash merge.

## Non-blocking decisions

If something is ambiguous but not blocking, pick the sensible default, write the
reasoning into `DECISIONS.md`, and keep going.
