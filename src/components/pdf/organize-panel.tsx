"use client";

import { ArrowLeft, ArrowRight, RotateCcw, RotateCw, Save, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { baseName } from "@/lib/pdf/files";
import type { PagePlan } from "@/lib/pdf/operations";

import { OutputFiles, type OutputFile } from "./output-files";
import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { runPdfJob } from "./pdf-worker-client";
import { moveItem } from "./reorder-list";
import { TaskStatus } from "./task-status";
import { useThumbnails } from "./use-thumbnails";
import { useTask } from "./use-task";

type Rotation = PagePlan["rotation"];

function turn(rotation: Rotation, by: 90 | -90): Rotation {
  return ((((rotation + by) % 360) + 360) % 360) as Rotation;
}

function initialPlan(pageCount: number): PagePlan[] {
  return Array.from({ length: pageCount }, (_, index) => ({ index, rotation: 0 }));
}

export function OrganizePanel() {
  const task = useTask();
  const source = usePdfSource("edit", task.run);
  const [plan, setPlan] = useState<PagePlan[] | null>(null);
  const [output, setOutput] = useState<OutputFile[]>([]);
  const thumbs = useThumbnails(source.pdf?.bytes ?? null);

  const pdf = source.pdf;
  if (!pdf) {
    return (
      <div className="flex flex-col gap-4">
        <PdfPicker onFiles={(files) => void source.choose(files)} />
        <TaskStatus state={task.state} />
      </div>
    );
  }

  const pages = plan ?? initialPlan(pdf.pageCount);
  const changed =
    plan !== null &&
    (plan.length !== pdf.pageCount ||
      plan.some((page, position) => page.index !== position || page.rotation !== 0));

  function update(next: PagePlan[]) {
    setPlan(next);
    setOutput([]);
  }

  async function save() {
    if (!pdf) return;
    const bytes = await task.run("Saving…", () =>
      runPdfJob({ op: "organize", bytes: pdf.bytes, plan: pages }),
    );
    if (bytes) {
      setOutput([{ name: `${baseName(pdf.name)}-organized.pdf`, bytes, type: "application/pdf" }]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PdfChip
        pdf={pdf}
        onClear={() => {
          source.clear();
          setPlan(null);
          setOutput([]);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update(pages.map((page) => ({ ...page, rotation: turn(page.rotation, 90) })))
          }
        >
          <RotateCw className="size-3.5" aria-hidden />
          Rotate all
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!changed}
          onClick={() => update(initialPlan(pdf.pageCount))}
        >
          <Undo2 className="size-3.5" aria-hidden />
          Start over
        </Button>
        <p className="text-muted-foreground ms-auto text-sm tabular-nums">
          {pages.length} of {pdf.pageCount} pages kept
        </p>
      </div>

      <ol
        aria-label="Pages"
        className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
      >
        {pages.map((page, position) => {
          const label = `page ${page.index + 1}`;
          const thumb = thumbs[page.index];
          return (
            <li
              key={`${page.index}-${position}`}
              className="bg-card ring-foreground/10 flex flex-col gap-1.5 rounded-xl p-2 ring-1"
            >
              <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-lg p-1">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local blob URL, which next/image cannot optimise
                  <img
                    src={thumb}
                    alt={`Page ${page.index + 1}`}
                    className="max-h-full max-w-full shadow-sm transition-transform"
                    style={{
                      transform: `rotate(${page.rotation}deg) scale(${page.rotation % 180 ? 0.75 : 1})`,
                    }}
                  />
                ) : (
                  <Skeleton className="h-4/5 w-3/5" />
                )}
              </div>
              <p className="text-center text-xs tabular-nums">
                <span className="font-medium">Page {page.index + 1}</span>
                {page.rotation ? (
                  <span className="text-muted-foreground"> · {page.rotation}°</span>
                ) : null}
              </p>
              <div className="grid grid-cols-3 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="w-full"
                  aria-label={`Rotate ${label} left`}
                  onClick={() =>
                    update(
                      pages.map((entry, at) =>
                        at === position ? { ...entry, rotation: turn(entry.rotation, -90) } : entry,
                      ),
                    )
                  }
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="w-full"
                  aria-label={`Rotate ${label} right`}
                  onClick={() =>
                    update(
                      pages.map((entry, at) =>
                        at === position ? { ...entry, rotation: turn(entry.rotation, 90) } : entry,
                      ),
                    )
                  }
                >
                  <RotateCw className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="w-full"
                  aria-label={`Delete ${label}`}
                  disabled={pages.length === 1}
                  onClick={() => update(pages.filter((_, at) => at !== position))}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="col-span-1 w-full"
                  aria-label={`Move ${label} earlier`}
                  disabled={position === 0}
                  onClick={() => update(moveItem(pages, position, position - 1))}
                >
                  <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
                </Button>
                <span />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="w-full"
                  aria-label={`Move ${label} later`}
                  disabled={position === pages.length - 1}
                  onClick={() => update(moveItem(pages, position, position + 1))}
                >
                  <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <Button
        className="sticky bottom-3 h-12 w-full shadow-lg sm:static sm:w-fit sm:shadow-none"
        disabled={!changed || task.working}
        onClick={() => void save()}
      >
        <Save className="size-4" aria-hidden />
        {changed ? "Save the new PDF" : "Rotate, move or delete a page first"}
      </Button>

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName="organized.zip" />
    </div>
  );
}
