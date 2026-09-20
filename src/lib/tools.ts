export type ToolStatus = "available" | "coming-soon";

export interface Tool {
  /** URL segment. This is the indexable route, so it doubles as the SEO slug. */
  slug: string;
  name: string;
  /** One line, shown on cards and in navigation. */
  tagline: string;
  /** Long form, used for per-route metadata descriptions. */
  description: string;
  status: ToolStatus;
  /**
   * Whether the tool works with no connection at all. Only the AI assistant
   * does not, and the UI says so honestly rather than failing silently.
   */
  offline: boolean;
  /** Extra search terms for metadata keywords. */
  keywords: string[];
}

/**
 * The registry drives navigation, the home grid, the sitemap and per-route
 * metadata. Adding a tool here is most of the work of adding a tool.
 *
 * User-facing copy lives in this data rather than inline in components, which
 * is the seam Urdu translations will plug into later.
 */
export const TOOLS: readonly Tool[] = [
  {
    slug: "gpa-calculator",
    name: "GPA & CGPA Calculator",
    tagline: "Semester GPA and cumulative CGPA on any grading scale",
    description:
      "Calculate semester GPA and cumulative CGPA across multiple grading scales including Pakistani HEC, 4.0, 5.0, 10-point and percentage. Solve for the GPA you need to hit a target CGPA, and export a transcript summary.",
    status: "coming-soon",
    offline: true,
    keywords: ["gpa", "cgpa", "hec", "grade point average", "semester", "transcript"],
  },
  {
    slug: "percentage-calculator",
    name: "Percentage Calculator",
    tagline: "Every percentage problem, with the formula shown",
    description:
      "Work out percentages of a value, percentage change, increase and decrease, reverse percentages, and marks to percentage with weighted assignments, midterms and finals. Each result shows the formula used.",
    status: "coming-soon",
    offline: true,
    keywords: ["percentage", "percent change", "marks", "weighted average"],
  },
  {
    slug: "unit-converter",
    name: "Unit Converter",
    tagline: "Sixteen categories, including live currency rates",
    description:
      "Convert length, mass, temperature, area, volume, speed, time, digital storage, data rate, pressure, energy, power, angle, fuel economy and currency. Exchange rates are cached so the converter keeps working offline.",
    status: "coming-soon",
    offline: true,
    keywords: ["unit converter", "currency", "metric", "imperial", "conversion"],
  },
  {
    slug: "citation-generator",
    name: "Citation Generator",
    tagline: "APA, MLA, Chicago, IEEE and Harvard from a DOI or ISBN",
    description:
      "Generate citations in APA 7, MLA 9, Chicago 17, IEEE and Harvard. Auto-fill from a DOI, ISBN, arXiv ID or PubMed ID, build a bibliography, and export to BibTeX, RIS or rich text that pastes cleanly into Word.",
    status: "coming-soon",
    offline: true,
    keywords: ["citation", "apa", "mla", "chicago", "ieee", "harvard", "bibliography", "doi"],
  },
  {
    slug: "timetable-maker",
    name: "Timetable Maker",
    tagline: "A weekly class grid that catches clashes",
    description:
      "Build a weekly class timetable with conflict detection, colour coding, and multiple saved timetables. Export to PNG, a print-optimised PDF, or an .ics file that imports straight into Google Calendar.",
    status: "coming-soon",
    offline: true,
    keywords: ["timetable", "class schedule", "conflict", "ics", "calendar"],
  },
  {
    slug: "pomodoro-timer",
    name: "Pomodoro Timer",
    tagline: "Focus sessions that stay accurate when your phone sleeps",
    description:
      "A pomodoro timer with configurable work and break lengths, a linked task list, and a weekly focus-time chart. Timing is based on timestamps rather than interval counting, so it does not drift when the tab is backgrounded.",
    status: "coming-soon",
    offline: true,
    keywords: ["pomodoro", "focus timer", "study timer", "productivity"],
  },
  {
    slug: "notes",
    name: "Notes Organizer",
    tagline: "Markdown notes with maths, tags and instant search",
    description:
      "Write notes in Markdown with live preview, code blocks and KaTeX maths. Organise with folders and tags, search everything instantly, and export a single note or a full backup you can import again.",
    status: "coming-soon",
    offline: true,
    keywords: ["notes", "markdown", "katex", "study notes", "search"],
  },
  {
    slug: "pdf-tools",
    name: "PDF Tools",
    tagline: "Merge, split, compress and convert, all in your browser",
    description:
      "Merge, split, reorder, rotate and delete PDF pages, convert images to PDF and back, extract text, add page numbers or a watermark, and compress. Every file is processed in your browser and never uploaded.",
    status: "coming-soon",
    offline: true,
    keywords: ["pdf", "merge pdf", "split pdf", "compress pdf", "watermark"],
  },
  {
    slug: "ai-assistant",
    name: "AI Study Assistant",
    tagline: "Explain, summarize, quiz and make flashcards",
    description:
      "Ask for a concept explained simply, summarize pasted text, generate flashcards you can export to Anki, take a quiz with explained answers, improve your writing, or work through a problem step by step.",
    status: "coming-soon",
    offline: false,
    keywords: ["ai tutor", "study assistant", "flashcards", "quiz", "summarize"],
  },
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export const TOOL_SLUGS = TOOLS.map((tool) => tool.slug);
