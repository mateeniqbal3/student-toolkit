const TOOLS = [
  "GPA & CGPA calculator",
  "Percentage calculator",
  "Unit converter",
  "Citation generator",
  "Timetable maker",
  "Pomodoro timer",
  "Notes organizer",
  "PDF tools",
  "AI study assistant",
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-3">
        <p className="font-display text-primary text-sm font-medium tracking-wide uppercase">
          Free forever
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold text-balance sm:text-5xl">
          Student Toolkit
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Nine tools every university student needs, in one fast app that works without a
          connection.
        </p>
      </div>

      <section aria-labelledby="tools-heading" className="flex flex-col gap-3">
        <h2 id="tools-heading" className="font-display text-muted-foreground text-sm font-medium">
          Shipping soon
        </h2>
        <ul aria-labelledby="tools-heading" className="grid gap-2 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <li
              key={tool}
              className="bg-surface rounded-lg border px-4 py-3 text-sm font-medium shadow-xs"
            >
              {tool}
            </li>
          ))}
        </ul>
      </section>

      <p className="bg-muted text-muted-foreground rounded-lg px-4 py-3 text-sm">
        Everything except the AI assistant runs entirely in your browser. Your grades, notes and
        files never leave your device.
      </p>
    </main>
  );
}
