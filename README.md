# Student Toolkit

Ten tools every university student needs, in one fast app that works without a
connection. Free forever, no account, no ads, no tracking.

> **Status:** in active development. The GPA calculator, percentage calculator,
> unit converter, citation generator, timetable maker, flashcards, pomodoro
> timer and notes organizer are built; PDF tools and the AI assistant are next.

## Why it exists

Most student calculators are ad-riddled single-purpose pages that need a good
connection and quietly upload whatever you type. This is one app, built for a
mid-range Android phone on a weak connection, where everything except the AI
assistant runs entirely in your browser.

## The tools

| Tool                    | What it does                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPA and CGPA calculator | Semester GPA and cumulative CGPA across pluggable grading scales, including Pakistani HEC, 4.0, 5.0, 10-point, percentage, and a custom-scale editor. Solves for the GPA needed to hit a target CGPA. |
| Percentage calculator   | Every mode students actually need, each showing the formula so it teaches rather than just answers.                                                                                                   |
| Unit converter          | Sixteen categories including live currency rates, cached for offline use.                                                                                                                             |
| Citation generator      | APA 7, MLA 9, Chicago 18, IEEE, and Harvard, auto-filled from a DOI, ISBN, arXiv, or PubMed ID.                                                                                                       |
| Timetable maker         | Weekly grid with conflict detection, exportable to PNG, PDF, and `.ics` for Google Calendar.                                                                                                          |
| Flashcards              | Spaced-repetition decks that bring each card back just before you would forget it, with import from and export to Anki.                                                                               |
| Pomodoro timer          | Drift-free timing that stays accurate when your phone sleeps, with session history.                                                                                                                   |
| Notes organizer         | Markdown with KaTeX maths, folders, tags, and instant full-text search.                                                                                                                               |
| PDF tools               | Merge, split, reorder, rotate, watermark, compress, convert, and extract, all in your browser.                                                                                                        |
| AI study assistant      | Explain, summarize, make flashcards, quiz you, and solve step by step.                                                                                                                                |

## Privacy

**Nothing you type leaves your device.** Your grades, notes, timetables,
citations and PDFs are stored in your own browser and never sent anywhere.
There is no account, no database, and no analytics cookie.

Two of the offline tools fetch public reference data: the unit converter
downloads exchange rates, and the citation generator sends a DOI, ISBN, arXiv
or PubMed ID you paste to a public catalogue to fill in the details. Neither
request carries anything about you, and both tools keep working offline.

The AI assistant is the one exception, because it has to reach a language model.
It sends only the message you type. You can also supply your own free API key in
settings, in which case your messages go straight to the provider.

## Local setup

Requires Node 22 or newer.

```bash
git clone https://github.com/mateeniqbal3/student-toolkit.git
cd student-toolkit
npm install
npm run dev
```

No API keys are needed to run or develop any tool but the AI assistant. Copy `.env.example`
to `.env.local` only if you want the AI assistant to use a shared key; see
`DEPLOY.md` for what each variable does.

## Tech stack

Next.js 16 (App Router) with React 19 and TypeScript in strict mode. Tailwind
CSS v4 with shadcn/ui and lucide-react. Dexie over IndexedDB for persistence.
Vitest and React Testing Library for unit tests, Playwright for end-to-end.
ESLint, Prettier, and Husky. GitHub Actions for CI, Vercel for hosting.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — conventions and how to work in this repo
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data models, IndexedDB schema, module boundaries
- [`DEPLOY.md`](./DEPLOY.md) — Vercel and Cloudflare Pages deployment
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — how to contribute
- [`DECISIONS.md`](./DECISIONS.md) — why things are the way they are

## License

MIT. See [`LICENSE`](./LICENSE).
