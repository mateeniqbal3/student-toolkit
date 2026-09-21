/**
 * Single source of truth for the things that appear in metadata, the footer,
 * structured data and the manifest. Changing the name or URL here changes it
 * everywhere.
 */
export const siteConfig = {
  name: "Student Toolkit",
  shortName: "Toolkit",
  tagline: "Ten study tools that work offline",
  description:
    "GPA calculator, citation generator, timetable maker, PDF tools and more. Free forever, works offline, and your data never leaves your device.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://student-toolkit.vercel.app",
  repository: "https://github.com/mateeniqbal3/student-toolkit",
  locale: "en",
} as const;
