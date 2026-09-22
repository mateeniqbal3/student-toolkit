# Decisions

Non-blocking choices made while building, with the reasoning. Newest first.
If a decision here turns out to be wrong, change it and amend the entry rather
than deleting it — the reasoning is the useful part.

## Phase 10 — AI study assistant

### Bring your own key, and no server at all

Asked for, and the right shape anyway: the student pastes their own free
Gemini key on first open, it is kept in `localStorage`, and the browser calls
Google directly. Google's API allows cross-origin requests from a page, so
the Route Handler the earlier plan described is not needed, and the project
now has **no server code whatsoever**. Hosting stays free with nothing to
meter, and no prompt of anyone's passes through us.

The cost is that the student needs a key. The alternative — a shared key —
means a server to keep it secret, rate limiting to protect it, and a bill
when the app is used. `.env.example` and `DEPLOY.md` described all of that;
both now say there is nothing to configure.

### Asking for the key is the first screen

The assistant opens on instructions rather than a chat box: the three steps
to get a key from `aistudio.google.com/apikey`, a field to paste it in, and
what happens to it. The key is checked against Google's model list — which
costs no tokens — before it is saved, so a mistyped key is caught there and
then rather than looking like a broken app on the first question.

### The models are what the API actually offered

Written against what the key could reach in September 2026, checked rather
than assumed: `gemini-3.6-flash` as the default, with `gemini-3.5-flash-lite`
and `gemini-3.8-flash` as the fast and thorough options. `gemini-2.5-flash`,
which older code would have reached for, is refused for new keys.

Two things the API only revealed under test:

- **`gemini-3.5-flash-lite` refuses `thinkingBudget: 0`** with a 400, while
  the other models accept it. Each model now carries the least thinking it
  will take, and the request asks for at least that.
- **A 400 is not always a bad key.** It is also what a malformed request
  returns, and telling a student their key is wrong when it is not sends them
  off to fix the wrong thing. The message decides which it was.

Every mode asks for no thinking except "Step by step", where it is worth
waiting for.

### A parser bug that quietly truncated every answer

The first version dropped whatever sat in the buffer when the stream closed.
Google's last event does not always end with a blank line, so the end of each
answer was being lost — invisible in prose, obvious once the flashcards mode
returned JSON that ended mid-word and would not parse. The parser now flushes
what is left when the stream ends, and a unit test and a real request both
cover it.

This is why the phase was built against the real API rather than a mock: no
mock of mine would have ended a stream that way.

### Free keys have small daily limits

The key used to build this hit `429` after about twenty requests on the
Balanced model. The app says so plainly when it happens and suggests the Fast
model, which is lighter. This is worth knowing before demonstrating it to
anyone: the limits are Google's, per key, per day.

### Modes are prompts, kept as data

Six ways of studying — explain, summarize, flashcards, quiz, improve writing,
step by step — each a system instruction in `lib/ai/modes.ts`, next to the
copy it shows. They all push towards something a student can learn from
rather than hand in, and the page carries a line saying answers can be wrong.

Flashcards are asked for as JSON, which is no use to read, so those answers
are rendered as the cards they describe and can be added straight into a deck
in the flashcards tool, where the spaced repetition already lives. Parsing
copes with code fences, chatter around the JSON, and the "Front — Back" lines
a model falls back to.

### What the tests cover, and what they cannot

The e2e suite stands in for Google, so it needs no key and no connection: it
can produce a refused key, a busy server that recovers on retry, a quota
error and a request that never answers. What it cannot do is tell us the API
still behaves as documented, which is what the real requests during the build
were for.

Chats are stored in IndexedDB (schema version 8) like everything else, and
the key never goes near them.

## Phase 9 — PDF tools

### Nine operations, nine routes

"Merge PDF" and "compress PDF" are searched for by name, so each operation
has its own page — `/pdf-tools/merge`, `/pdf-tools/compress` — built at
deploy time from a registry beside the tool registry, with its own title,
description and place in the sitemap. `/pdf-tools` is a hub that links to
them. Each panel is a separate chunk, so the merge page does not carry the
organiser's code. The hub costs 191.8KB and an operation page 211.6KB,
against budgets of 200KB and 225KB.

`ToolShell` gained an optional heading and a "back" link so an operation
page can name itself in its `h1` while still being part of the PDF tool.

### pdf-lib in a worker, pdf.js for everything that reads

pdf-lib does the editing, in a Web Worker, so merging or stamping a 50MB
file never freezes the page: this is what `ARCHITECTURE.md` always planned
`src/workers/` for. The operations themselves are pure functions from bytes
to bytes, which is what lets the unit tests run them on real PDFs in Node.
pdf.js does everything that needs to see the page: thumbnails, pages as
images, text.

pdf-lib was last released in 2022. It is stable, it does what is needed, and
`@cantoo/pdf-lib` is a maintained drop-in fork if that ever stops being
true.

### pdf.js's legacy build, for phones that are a few years old

The modern pdf.js build calls `Promise.try`, which arrived in Safari 18.2
and Chrome 128. Students on an older iPhone or a mid-range Android would
have got a blank page. The legacy build ships the polyfills and costs a
little more; for this audience that is the right trade. Node 22 lacks
`Promise.try` too, so the unit tests caught it before any browser did.

### The service worker was handing one worker the other's code

The PDF pages are the first to run two Web Workers at once, and that
uncovered a bug in the offline caching. Turbopack starts every worker from
one shared bootstrap script and says which chunks to load in the URL's
fragment (`…/turbopack-worker.js#params=…`). The Cache API ignores
fragments, so the second worker was served the first one's cached response —
fragment included — and booted the wrong half of the app. pdf-lib's worker
would start pdf.js's message handler, and the job would hang forever with no
error.

Worker scripts are now served as a fresh `Response` built from the cached
body. A response made that way has no URL of its own, so the browser keeps
the one the worker asked for. An e2e test reloads the page first, so the
service worker is in charge, and fails without the fix.

This only ever happened on a second visit, which is exactly the visit a
student would make.

### Two kinds of compression

Light rewrites the file's structure and keeps text selectable; it saves
little on an already-tidy PDF, and the page says so rather than offering a
download that is no smaller. Strong and Smallest redraw each page as a JPEG
at 144 or 96 DPI and rebuild the PDF around it, which is what actually
shrinks the scans and phone photos students are asked to upload, at the cost
of selectable text. The page says that in as many words.

Redrawing also means Compress, PDF to images and Extract text work on PDFs
that are locked against editing, because pdf.js opens those and pdf-lib does
not. Operations that edit check the file with pdf-lib as soon as it is
chosen, so a locked file is refused before the student sets everything up,
with a message suggesting printing it to a new PDF.

### Images are decoded, not embedded as they arrive

Every image goes through `createImageBitmap` with `imageOrientation:
"from-image"` and back out of a canvas. That applies the EXIF rotation phone
cameras write, which is the difference between a photo of homework appearing
upright or sideways. Images are scaled to at most 3000 pixels on the long
side — about 250 DPI on A4, sharper than any printer a student will use —
which keeps twenty photos inside an upload limit. PNGs stay PNGs so
screenshots keep their sharp edges; everything else becomes JPEG at 0.9,
composited onto white so a transparent GIF does not turn black.

### Stamped text is placed where the reader sees it

A page with a `/Rotate` is drawn in unrotated coordinates and turned for
display, so "the bottom of the page" is not where it sounds. `toPageSpace`
maps what the reader sees onto the page's own coordinates, and the unit
tests check a page number lands at the bottom of a page rotated 90°, read
back with pdf.js.

The built-in PDF fonts cover Latin text only. Watermark and page-number text
outside that is refused with an explanation rather than silently garbled.
Urdu watermarks would need an embedded Unicode font, which is a megabyte;
when this app is translated, that is the phase to weigh it in.

### No OCR

Extracting text from a scan needs OCR, which means Tesseract: several
megabytes of WASM plus a language model per language. That is a phase of its
own, not a checkbox here, so a PDF with no text says exactly that and
explains why.

### Offline after first use

pdf-lib and pdf.js are only fetched when a file is chosen, and the service
worker caches them from then on. They are deliberately not warmed at idle
like the notes renderer: together they are about 700KB, and most visitors to
a PDF page use one operation, not all nine. So the first use of PDF tools
needs a connection, and every use afterwards does not.

## Phase 8 — notes organizer

### Phase 8 is the notes organizer

Like Phase 7, this phase came without a written spec and follows registry
order. The registry entry was the brief: Markdown with live preview, code
blocks, KaTeX maths, folders, tags, instant search, and export of a single
note or a full backup that imports again.

### markdown-it, KaTeX and MiniSearch, all loaded late

Three new dependencies, all MIT and needing no account or service:
markdown-it, KaTeX (through Microsoft's `@vscode/markdown-it-katex` plugin)
and MiniSearch. KaTeX is pinned to 0.16 because the plugin requires it, and
two copies would double the heaviest part.

None of them is in the page's initial download. The renderer (markdown-it,
KaTeX and KaTeX's stylesheet and fonts) loads the first time a preview is
shown. MiniSearch loads the first time someone searches, with a plain
substring match covering the few milliseconds before it arrives. Both are
also fetched once the page is idle, which puts them in the service worker's
cache so they work offline from the second visit. Loading MiniSearch late
took the route from 241.7KB to 236.4KB, against a 245KB budget.

KaTeX's fonts load only when maths is rendered. A student whose first ever
maths preview happens offline sees it in fallback fonts until they next
connect. That is readable, and it is better than every visitor downloading
fonts they may never need.

### The preview is safe by configuration, not by sanitising

Rendered notes go into the page as HTML, so the renderer is set up so that
nothing a note contains can run. markdown-it has raw HTML off, so `<script>`
shows as text. It refuses `javascript:` links. KaTeX runs with `trust` off,
so `\href` and `\includegraphics` produce an error mark, not a link or
image. Unit tests and an e2e test pin each of these. A sanitiser such as
DOMPurify on top would add weight to guard against output these settings
already cannot produce.

### Remote images are links, not images

`![diagram](https://…)` renders as a link. An `<img>` would make the browser
fetch from that server every time the note was opened, telling it when and
from which IP. Notes that never leave the device should not report being
read. Embedding local images would mean storing blobs in IndexedDB. That is
worth doing only if students ask for it.

### Trash instead of delete; no archive

Deleting a note moves it to a trash it can be restored from. Only "Delete
forever" and "Empty trash" ask for confirmation, since only they cannot be
undone. The trash is never emptied automatically: silently deleting a
student's work on a timer is the wrong default. The planned archive was
left out because a folder does the same job.

As with the pomodoro tasks, the planned boolean indexes (`isPinned`,
`isTrashed`) are gone, because IndexedDB cannot index booleans. The trash is
a `trashedAt` time, and filtering happens in memory over every note, which is
also what search needs. The table is `noteFolders` rather than `folders`,
because other tools may want folders too.

### Autosave, and the editor ignores its own echo

Typing saves 400ms after it stops. It also saves at once when the note is
closed, the tab is hidden or the page unloads, which covers a phone
switching apps mid-sentence. While a note is open, its text is held in the
editor and not re-read from the live query: each save echoing back would
otherwise reset the cursor. Pinning does not change a note's "updated" time,
because it is not an edit.

### Import adds and never overwrites

A backup is one JSON file with a format name and version. Importing it adds
its folders and notes: a folder with the same name in the same place is
reused, and a note with the same title and text as one already here is
skipped. Importing twice therefore changes nothing. Markdown files, from
this app or from Obsidian and the like, go into the folder being viewed, and
their front matter (title, tags, dates) is honoured. A note that is only in
the trash does not count as already here, so importing is also a way to get
it back.

A single note downloads as `.md` with front matter, and it round-trips
through import.

### Two panes need a wider page

`ToolShell` takes a `wide` option (72rem rather than 56rem) for tools laid
out in two panes. On a phone the list and the open note replace each other,
with a back button. Wide equations and code blocks scroll inside their own
box, which needs the grid tracks to be `minmax(0, 1fr)`. The e2e suite
caught the default letting one long equation widen the page at 360px.

## Phase 7 — pomodoro timer

### Phase 7 is the pomodoro timer

Phase 7 arrived without a written spec. Every phase so far has built the
next tool in registry order, and the next one marked coming soon was the
pomodoro timer, whose tables were already planned in `ARCHITECTURE.md`. So
that is what this phase built. A Phase 0 note calls the full browser matrix
"a Phase 7 task"; that note predates the change from nine tools to ten, and
the browser matrix stays a pre-launch task.

### Time comes from timestamps, never from counting ticks

A running phase stores when it ends, and the time left is always
`endsAt - now`. The interval only repaints the display. Browsers throttle
timers in background tabs and phones suspend them outright, so an app that
counts ticks drifts by minutes. This one is right the moment it is looked at
again. When several phases ended while the page slept (with auto-start on),
`settle` replays them from their scheduled end times, so an hour away lands
exactly where an hour watching would have.

A started phase also stores its own length. Changing the settings affects
the next phase and never rewrites the one running.

### The running timer lives in localStorage

The timer state and settings are small and read before first paint, which is
what `ARCHITECTURE.md` reserves localStorage for. Keeping the running timer
there rather than in React state means a reload, a closed tab or a phone that
killed the browser picks up where it was, and a second tab shows the same
timer. Everything read back is validated, and anything malformed falls back
to a fresh timer.

### The session is saved before the timer moves on

When a phase ends, the session is written to IndexedDB first and only then
does the stored timer state advance. The e2e suite caught the other order
losing sessions: the page closed after the state moved on but before the
write landed. In this order a page that closes in between leaves the timer
still "running". The next visit settles the same phase again, and the write
is skipped because a session with that start time already exists. The same
check stops two open tabs from recording one session twice.

### What gets recorded

Only focus is recorded, not breaks: the history answers "how much did I
study". A session that runs its full length counts as a pomodoro. Focus cut
short by skip, reset or switching phase still counts towards focus minutes
if it lasted at least a minute, but not as a pomodoro. Under a minute is
treated as a mis-tap. A session belongs to the day it started, and weeks
start on Monday (ISO 8601).

A task's pomodoro count is stored on the task and incremented in the same
transaction as the session, rather than counted from history each time.
Clearing the history therefore leaves the task counts alone. That fits what
they are: a record against the estimate.

### Tasks are indexed by creation time, not by "done"

The planned `isDone` index would never have worked: IndexedDB cannot index
booleans, so no record would ever have matched it. Tasks store `doneAt` (a
time or null) and are filtered in memory. A task list is a few dozen rows.

### Alerts: a synthesised chime, and notifications only when out of sight

The chime is three notes from Web Audio, so there is no sound file to
download or cache. The audio context is unlocked by the Start button,
because browsers block audio that no gesture started. System notifications
are opt-in, requested only when the switch is turned on, and shown only when
the page is hidden. They go through the service worker when one is
registered, because Chrome on Android refuses `new Notification()`. A tap
on one focuses the timer's tab or reopens it.

A background tab's timers can be throttled to about once a minute, so a
notification can arrive up to a minute late. The time shown is never wrong.
Getting the notification exactly on time would need a push server, which
this project will not run.

### The weekly chart is plain elements, not a chart library

Seven bars need no library, and the route was already close to its budget.
It is one series, so one colour (`--primary`, with today at full strength).
The scale has two recessive gridlines at round values. Each bar shows its
value on hover, and a visually hidden table gives screen readers the exact
numbers. The route measures 237.8KB and its budget is 245KB, the same as the
other tools that store data.

`useNow` moved from the flashcards folder to `src/hooks`, since both tools
now use it.

## Phase 6 — flashcards

### Flashcards are a tenth tool, not part of the AI assistant

The original plan had nine tools, with flashcards only as something the AI
assistant would generate and export to Anki. Phase 6 was specified as a
flashcard system, and a study tool that needs a language model, a network
connection and a shared API quota to review a deck would break the rule the
rest of the app is built on. So flashcards are their own tool: local,
offline, no account. When the AI assistant lands, generating cards should
mean adding them to a deck here, rather than a second flashcard system.

Every mention of "nine tools" is now "ten", and "tools 1-8" — which
numbered the offline tools and would now leave this one out — is reworded as
"every tool except the AI assistant".

### Scheduling is Anki's SM-2, written here rather than imported

New cards go through 1- and 10-minute learning steps and graduate to one
day; each successful review then multiplies the interval by the card's ease
(2.5 to start, adjusted by Hard and Easy, never below 1.3); forgetting a card
sends it through a 10-minute relearning step and lowers its ease. These are
Anki's defaults, so a student moving between the two sees the same
behaviour, and each answer button shows what it will do ("10m", "4d").

FSRS, Anki's newer scheduler, is measurably better at predicting forgetting,
but it needs a review history to fit its parameters, and its library would
be the one piece of scheduling logic here that could not be explained in a
paragraph or tested line by line. SM-2 is a hundred lines, pure and fully
tested. A later move to FSRS can happen per card: the stored state already
has what it needs to start from.

Two small departures: intervals are not randomly fuzzed (so tests and the
button labels are exact), and a day ends at local midnight rather than
Anki's 4am.

### Study order and the daily limit

Due learning cards first, then reviews due today (most overdue first), then
new cards in the order they were written, up to the deck's daily limit
(twenty by default). When nothing else is left, a learning card due within
twenty minutes is shown early rather than making the student wait. A card
counts against the new-card limit on the day it is first studied.

### Cards have their own table

Unlike a timetable's classes, cards are written to one at a time, dozens of
times a session, and a deck can hold hundreds. Embedding them in the deck
would rewrite the whole deck on every answer. `cards` is indexed by deck
only: the study queue is worked out in memory from a deck's cards, which is
simpler than keeping a due-date index in step and fast enough at this size.

### Import and export speak Anki's plain text

Anki's "Notes in Plain Text" export is tab-separated with `#separator:` and
`#html:` header lines, Quizlet exports tab- or comma-separated pairs, and
spreadsheets write CSV. Import detects the separator (honouring Anki's
header, then any tab, then whichever of semicolon or comma is commoner),
parses quoted fields properly, turns Anki's HTML line breaks into line
breaks and drops other markup. It shows how many cards it found and how many
lines it will skip before anything is added. Export writes TSV with Anki's
headers, or CSV, and round-trips through import unchanged.

### Undo instead of confirm, again

The last answer in a study session can be undone (button or Z), because a
mis-tap on Again resets a card's progress. Deleting a card is undoable too.
Deleting a whole deck and resetting its progress still ask first.

## Phase 5 — timetable maker

### Phones get a day view, not a squeezed week

Seven columns at 360px are about 40px each, too narrow to read a course
name, and scrolling the grid sideways breaks the no-horizontal-scroll rule.
Below the small breakpoint the tool shows one day at a time: a row of day
tabs with class counts, and each class as a full-width card. It opens on
today. The week grid takes over from 640px, and always prints, whatever the
screen.

### "PDF" is the print stylesheet, not a PDF library

The week prints on a named landscape A4 page with everything but the grid
hidden, colours kept (`print-color-adjust: exact`) and dark mode swapped for
light, because paper is white. Every browser's print dialog, including
Android Chrome's, can save that as a PDF. Generating the PDF ourselves would
mean pulling in pdf-lib and drawing the grid a third time, for a file no
better than the browser's.

The named page sits on the tool's root element rather than on the grid,
because changing page names forces a page break and left a blank first page.

### The PNG is drawn on a canvas, not screenshotted

html2canvas is about 45KB and reproduces CSS approximately. A timetable is
rectangles and text, which the canvas draws exactly for nothing. The export
reads the live theme tokens, so it matches the screen in either theme, and it
always draws the full week at 2x, even from a phone showing the day view.

### Calendar export repeats weekly across a term, in floating time

Each class becomes one event with `RRULE:FREQ=WEEKLY;UNTIL=` the last day of
term, starting on its first occurrence on or after the first day. Times are
floating (no time zone), which is what a class timetable means — 9:00 is 9:00
wherever the calendar is — and avoids writing VTIMEZONE blocks, the usual
source of broken hand-made .ics files. Lines are folded at 75 octets without
splitting a multi-byte character, so Urdu course names survive. The term
dates are the only extra input, and they are remembered per timetable.

### Clashes are flagged, never blocked

Students do have clashing classes: two sections they are choosing between, a
lab that overruns into a lecture. The form warns while typing and names the
class it clashes with, the page lists every clash with its overlapping
window, and clashing blocks sit side by side in the grid with a red outline.
Nothing refuses to save. Back-to-back classes (one ends at 10:00, the next
starts at 10:00) are not a clash.

### A new class can go on several days at once, then each day is its own

A Monday–Wednesday lecture is one thing to type in, so the form takes several
days. Once saved, each day is a separate entry, so moving Wednesday's room
does not move Monday's.

### The same course keeps its colour

Typing a course name the timetable already has picks up that course's
colour; a new course takes the least-used of the eight. Choosing a colour by
hand stops the suggestion. The colours are new role tokens (`--course-1` to
`--course-8`), defined for both themes, and used as a solid edge plus a light
tint behind normal text, so text contrast does not depend on the hue.

### Hidden days and hours never hide a class

The grid shows the student's chosen days and hours, stretched to whole hours
around any class outside them, and any day with a class stays visible even if
it was switched off. Settings narrow the grid; they never make data vanish.

### Duplicating is how a student compares options

Registration often comes down to choosing between sections. Duplicating a
timetable copies every class with fresh ids, so "Plan B" can be edited
without touching the original.

### The collection picker is shared

Bibliographies and timetables need the same select, rename, new, delete
control, so the Phase 4 version became `CollectionPicker`, with an optional
duplicate action. The citation generator now uses it too.

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
