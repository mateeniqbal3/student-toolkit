import { Lock, WifiOff, Zap } from "lucide-react";
import Link from "next/link";

import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";
import { TOOL_ICONS } from "@/lib/tool-icons";
import { TOOLS } from "@/lib/tools";

const PROMISES = [
  {
    icon: Lock,
    title: "Your data stays here",
    body: "Grades, notes, timetables and PDFs are stored in your browser. There is no account and no server to leak them.",
  },
  {
    icon: WifiOff,
    title: "Works without a connection",
    body: "Install it once and every tool except the AI assistant keeps working on the bus, in a basement, or on no signal at all.",
  },
  {
    icon: Zap,
    title: "Built for slow phones",
    body: "Small bundles, no heavy frameworks per tool, and nothing loads that you have not opened.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4">
      <section className="flex flex-col items-start gap-5 py-12 sm:py-16">
        <p className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="bg-primary size-1.5 rounded-full" aria-hidden />
          Free forever, no account needed
        </p>

        <h1 className="font-display text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Nine study tools that <span className="text-primary">work offline</span>
        </h1>

        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          {siteConfig.description}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/gpa-calculator">Calculate my GPA</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={siteConfig.repository} target="_blank" rel="noreferrer">
              <GitHubIcon className="size-4" aria-hidden />
              Source on GitHub
            </a>
          </Button>
        </div>
      </section>

      <section id="tools" aria-labelledby="tools-heading" className="scroll-mt-20 pb-4">
        <h2 id="tools-heading" className="font-display text-xl font-semibold tracking-tight">
          The tools
        </h2>

        <ul
          aria-labelledby="tools-heading"
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {TOOLS.map((tool) => {
            const Icon = TOOL_ICONS[tool.slug];
            return (
              <li key={tool.slug}>
                <Link
                  href={`/${tool.slug}`}
                  className="group bg-card hover:border-primary/40 flex h-full flex-col gap-2 rounded-xl border p-4 transition-colors"
                >
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="font-display group-hover:text-primary font-semibold transition-colors">
                    {tool.name}
                  </span>
                  <span className="text-muted-foreground text-sm text-pretty">{tool.tagline}</span>
                  {!tool.offline ? (
                    <span className="text-muted-foreground mt-auto pt-2 text-xs">
                      Needs a connection
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="promises-heading" className="py-12">
        <h2 id="promises-heading" className="sr-only">
          Why this is different
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {PROMISES.map((promise) => (
            <div key={promise.title} className="flex flex-col gap-2">
              <promise.icon className="text-primary size-5" aria-hidden />
              <h3 className="font-display font-semibold">{promise.title}</h3>
              <p className="text-muted-foreground text-sm text-pretty">{promise.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
