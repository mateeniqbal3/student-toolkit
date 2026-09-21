# Architecture

> Status: Phase 0. The module boundaries below are committed to; the Dexie
> schema is the plan, and this file is updated as each table actually lands.

## The one rule

**No user data leaves the device.** Every calculation, every file
transformation, and every byte a student types stays in the browser. This is
not a privacy garnish, it is the load-bearing decision:

- Hosting stays free forever, because there is no server compute and no database.
- The app works offline, which matters on patchy mobile connectivity.
- There is no user data to breach, because there is no user data on any server.

Earlier drafts of this file said "tools 1-8 make zero network requests", which
was the wrong way to state it: two of those tools have always been specified to
fetch public reference data, and the rule that actually matters is about user
data rather than about packets. Exactly three tools reach the network, and it
is worth being precise about what each request carries:

| Tool               | Request                             | Carries what the student typed?                                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Unit converter     | A public exchange-rate table        | No. It asks for a list of numbers and says nothing about the amount being converted. |
| Citation generator | A DOI, ISBN, arXiv or PubMed lookup | Only the public document identifier that was pasted in.                              |
| AI study assistant | The prompt, to a language model     | Yes, necessarily — and the UI says so rather than burying it.                        |

None of these requests carries a cookie, an account or any identifier, and the
first two degrade to cached or manual data when they fail. Tools 1-8 still need
no account, no database and no server compute of our own; the AI assistant is
quarantined behind one Route Handler and remains the only server code in the
project.

## Layers

```
src/
  app/                  route segments, one indexable route per tool
    (tools)/gpa-calculator/
    (tools)/citation-generator/
    ...
    api/ai/             the ONLY server code in the project
  components/
    ui/                 shadcn primitives, no app knowledge
    <feature>/          feature components, may read stores
  lib/
    <domain>/           pure functions: grading scales, unit tables, citations
    db/                 Dexie schema, migrations, typed accessors
    ai/                 provider interface + adapters (gemini, groq, ...)
  workers/              Web Workers for PDF and other heavy work
```

The dependency rule runs one way: `app` then `components` then `lib`. Nothing in
`lib/<domain>` imports React, which is what makes the arithmetic directly
unit-testable and keeps it out of any render path.

## The tool registry

`src/lib/tools.ts` is the single source of truth for the nine tools. It drives
navigation, the home grid, the sitemap, and per-route metadata, so adding a tool
is mostly a matter of adding an entry.

It holds data only, never components. Client components import it, and anything
an imported module references is bundled for the browser whether or not the
browser uses it. Icons therefore live separately in `src/lib/tool-icons.ts`,
read only by server components, which renders them into HTML at no client cost.

User-facing copy lives in the registry rather than inline in JSX. That is the
seam Urdu translations plug into later.

## Persistence

Two stores, chosen by size and access pattern.

**localStorage** holds small synchronous preferences only: theme, last-used
grading scale, last-used unit pair, BYOK key. These need to be readable before
first paint, and they are tiny.

**IndexedDB via Dexie** holds everything else. Planned schema:

| Table              | Indexes                                                             | Holds                                      |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| `semesters`        | `++id, order`                                                       | semester name, term, embedded courses      |
| `gradingScales`    | `++id, name`                                                        | custom letter to point to percent mappings |
| `timetables`       | `++id, name, updatedAt`                                             | grid config and embedded entries           |
| `notes`            | `++id, folderId, updatedAt, *tags, isPinned, isArchived, isTrashed` | markdown body and metadata                 |
| `folders`          | `++id, parentId, order`                                             | note folder tree                           |
| `pomodoroSessions` | `++id, startedAt, taskId`                                           | completed focus sessions                   |
| `tasks`            | `++id, isDone, updatedAt`                                           | pomodoro task list                         |
| `citations`        | `++id, projectId, createdAt`                                        | CSL-JSON source records                    |
| `citationProjects` | `++id, name`                                                        | bibliography groupings                     |
| `aiConversations`  | `++id, updatedAt`                                                   | chat history, embedded messages            |
| `currencyRates`    | `base`                                                              | cached FX table and fetch timestamp        |

Design notes:

- **Embedded over relational.** A timetable's entries live inside the timetable
  record rather than in a join table. IndexedDB has no joins, the collections are
  small and always loaded together, and one `put` is one atomic save.
- **Migrations are additive.** Every schema change is a new `db.version(n)`
  block; existing versions are never edited. A student who has not opened the app
  in six months must be upgraded, not reset.
- **Search is built, not stored.** The MiniSearch index over notes is rebuilt in
  memory at load rather than persisted, because rebuilding a few hundred notes is
  fast and a stale persisted index is a correctness bug waiting to happen.

## The AI boundary

```
client -> POST /api/ai (Route Handler) -> provider adapter -> Gemini
```

`lib/ai/provider.ts` defines the interface; each adapter implements it, and
swapping providers is one file plus one env var. The shared API key is read from
server-only env and never reaches the client bundle.

Three independent guards protect the shared key: a per-IP sliding-window limiter
in the handler, a hard cap on output tokens per request, and a daily global token
budget that flips the app to bring-your-own-key when exceeded. In BYOK mode the
student's own key is read from localStorage and forwarded to the provider, so the
app stays fully useful when the shared quota is gone.

## Offline

A hand-rolled service worker precaches the app shell and the static assets for
tools 1-8. Navigation requests use stale-while-revalidate; `/api/ai` is never
cached. Currency rates are cached in IndexedDB with a timestamp, and the UI shows
"rates as of X" rather than failing when offline.
