"use client";

import { Combine } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/pdf/files";

import { FilePicker } from "./file-picker";
import { OutputFiles, type OutputFile } from "./output-files";
import { readPdfFile, type LoadedPdf } from "./pdf-source";
import { runPdfJob } from "./pdf-worker-client";
import { ReorderList } from "./reorder-list";
import { TaskStatus } from "./task-status";
import { messageFor, useTask } from "./use-task";

interface Item extends LoadedPdf {
  id: string;
}

let nextId = 0;

export function MergePanel() {
  const task = useTask();
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [output, setOutput] = useState<OutputFile[]>([]);

  async function add(files: File[]) {
    const problems: string[] = [];
    await task.run("Opening…", async (progress) => {
      const added: Item[] = [];
      for (const [index, file] of files.entries()) {
        if (files.length > 1) progress(`Opening ${index + 1} of ${files.length}…`);
        try {
          added.push({ ...(await readPdfFile(file, "edit")), id: String(nextId++) });
        } catch (error) {
          problems.push(`${file.name}: ${messageFor(error)}`);
        }
      }
      setItems((current) => [...current, ...added]);
    });
    setSkipped(problems);
    setOutput([]);
  }

  async function merge() {
    const bytes = await task.run("Merging…", () =>
      runPdfJob({ op: "merge", files: items.map((item) => item.bytes) }),
    );
    if (bytes) setOutput([{ name: "merged.pdf", bytes, type: "application/pdf" }]);
  }

  const pages = items.reduce((sum, item) => sum + item.pageCount, 0);

  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 ? (
        <ReorderList
          label="PDFs to merge, in order"
          items={items}
          describe={(item) => item.name}
          render={(item) => (
            <>
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {item.pageCount === 1 ? "1 page" : `${item.pageCount} pages`} ·{" "}
                {formatBytes(item.bytes.length)}
              </p>
            </>
          )}
          onChange={(next) => {
            setItems(next);
            setOutput([]);
          }}
        />
      ) : null}

      <FilePicker
        accept="application/pdf,.pdf"
        multiple
        compact={items.length > 0}
        label={items.length > 0 ? "Add more PDFs" : "Choose PDFs to merge"}
        hint="Pick several at once, or drop them here. Put them in order afterwards."
        onFiles={(files) => void add(files)}
      />

      {skipped.length > 0 ? (
        <ul role="alert" className="text-destructive flex flex-col gap-1 text-sm">
          {skipped.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <Button
          className="h-12 w-full sm:w-fit"
          disabled={items.length < 2 || task.working}
          onClick={() => void merge()}
        >
          <Combine className="size-4" aria-hidden />
          {items.length < 2
            ? "Add at least two PDFs"
            : `Merge ${items.length} PDFs (${pages} pages)`}
        </Button>
      ) : null}

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName="merged.zip" />
    </div>
  );
}
