"use client";

import { FileImage } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { baseName, formatBytes } from "@/lib/pdf/files";
import type { EmbeddableImage, PageSize } from "@/lib/pdf/operations";

import { ChoiceGroup } from "@/components/choice-group";
import { FilePicker } from "./file-picker";
import { OutputFiles, type OutputFile } from "./output-files";
import { runPdfJob } from "./pdf-worker-client";
import { canvasToBytes, releaseCanvas } from "./pdfjs";
import { ReorderList } from "./reorder-list";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

/**
 * Photos are scaled down to this long side. At A4 that is still about 250
 * DPI, sharper than any printer a student will use, and it keeps a PDF of
 * twenty phone photos under an upload limit.
 */
const MAX_SIDE = 3000;

const SIZES: { value: PageSize; label: string }[] = [
  { value: "fit", label: "Fit each image" },
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
];

type Margin = "none" | "small" | "normal";
const MARGINS: { value: Margin; label: string }[] = [
  { value: "none", label: "No margin" },
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
];
const MARGIN_POINTS: Record<Margin, number> = { none: 0, small: 18, normal: 36 };

interface Item {
  id: string;
  file: File;
  preview: string;
}

let nextId = 0;

/**
 * Decodes an image the way it looks, which for a phone photo means applying
 * its EXIF rotation, then re-encodes it: PNG stays PNG so screenshots keep
 * their sharp edges and transparency; everything else becomes JPEG.
 */
async function prepare(file: File): Promise<EmbeddableImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no-canvas");
  const png = file.type === "image/png";
  if (!png) {
    // JPEG has no transparency; a transparent GIF or WebP goes onto white, not black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const bytes = await canvasToBytes(canvas, png ? "image/png" : "image/jpeg", 0.9);
  const image: EmbeddableImage = {
    bytes,
    format: png ? "png" : "jpeg",
    width: canvas.width,
    height: canvas.height,
  };
  releaseCanvas(canvas);
  return image;
}

export function ImagesPanel() {
  const task = useTask();
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<PageSize>("fit");
  const [margin, setMargin] = useState<Margin>("small");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [output, setOutput] = useState<OutputFile[]>([]);

  // Previews are object URLs: each is released when its image leaves the
  // list, and whatever is left when the page does.
  const current = useRef<Item[]>([]);
  useEffect(() => {
    current.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const item of current.current) URL.revokeObjectURL(item.preview);
    },
    [],
  );

  function replace(next: Item[]) {
    for (const item of items) {
      if (!next.includes(item)) URL.revokeObjectURL(item.preview);
    }
    setItems(next);
    setOutput([]);
  }

  function add(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const rejected = files.filter((file) => !file.type.startsWith("image/"));
    setItems((current) => [
      ...current,
      ...images.map((file) => ({
        id: String(nextId++),
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
    setSkipped(rejected.map((file) => `${file.name} is not an image.`));
    setOutput([]);
  }

  async function convert() {
    const problems: string[] = [];
    const bytes = await task.run("Preparing images…", async (progress) => {
      const images: EmbeddableImage[] = [];
      for (const [index, item] of items.entries()) {
        progress(`Preparing image ${index + 1} of ${items.length}…`);
        try {
          images.push(await prepare(item.file));
        } catch {
          problems.push(
            `${item.file.name} could not be opened by this browser${
              /\.hei[cf]$/i.test(item.file.name)
                ? ". iPhone HEIC photos open in Safari; elsewhere, share them as JPEG first."
                : "."
            }`,
          );
        }
      }
      progress("Making the PDF…");
      return runPdfJob({
        op: "images",
        images,
        layout: { pageSize: size, margin: MARGIN_POINTS[margin] },
      });
    });
    setSkipped(problems);
    const first = items[0];
    if (bytes && first) {
      const name = items.length === 1 ? `${baseName(first.file.name)}.pdf` : "images.pdf";
      setOutput([{ name, bytes, type: "application/pdf" }]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 ? (
        <ReorderList
          label="Images, one per page, in order"
          items={items}
          describe={(item) => item.file.name}
          render={(item) => (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
              <img
                src={item.preview}
                alt=""
                className="bg-muted size-12 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {formatBytes(item.file.size)}
                </p>
              </div>
            </div>
          )}
          onChange={replace}
        />
      ) : null}

      <FilePicker
        accept="image/*"
        multiple
        compact={items.length > 0}
        label={items.length > 0 ? "Add more images" : "Choose images"}
        hint="Photos of pages, screenshots or scans. Pick several at once."
        onFiles={add}
      />

      {skipped.length > 0 ? (
        <ul role="alert" className="text-destructive flex flex-col gap-1 text-sm">
          {skipped.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <>
          <ChoiceGroup
            label="Page size"
            options={SIZES}
            value={size}
            onChange={(next) => {
              setSize(next);
              setOutput([]);
            }}
          />
          {size !== "fit" ? (
            <ChoiceGroup
              label="Margin"
              options={MARGINS}
              value={margin}
              onChange={(next) => {
                setMargin(next);
                setOutput([]);
              }}
            />
          ) : null}
          <Button
            className="h-12 w-full sm:w-fit"
            disabled={task.working}
            onClick={() => void convert()}
          >
            <FileImage className="size-4" aria-hidden />
            Make a PDF of {items.length} {items.length === 1 ? "image" : "images"}
          </Button>
        </>
      ) : null}

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName="images.zip" />
    </div>
  );
}
