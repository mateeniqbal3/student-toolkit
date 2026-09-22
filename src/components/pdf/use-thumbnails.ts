"use client";

import { useEffect, useState } from "react";

import { canvasToBytes, openDocument, releaseCanvas, renderPage } from "./pdfjs";

/** Thumbnail width in CSS pixels; drawn sharper on high-density screens. */
const THUMB_WIDTH = 150;

/**
 * Small images of every page, drawn one at a time so the first ones appear
 * straight away and a 300-page PDF never holds hundreds of canvases at once.
 * Each is kept as a compressed image URL, released when the file changes.
 */
export function useThumbnails(bytes: Uint8Array | null): (string | undefined)[] {
  const [thumbs, setThumbs] = useState<(string | undefined)[]>([]);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    const urls: string[] = [];
    const density = Math.min(window.devicePixelRatio || 1, 2);

    void (async () => {
      let opened: Awaited<ReturnType<typeof openDocument>> | null = null;
      try {
        opened = await openDocument(bytes);
        const { doc } = opened;
        if (!cancelled) setThumbs(Array.from({ length: doc.numPages }, () => undefined));
        for (let number = 1; number <= doc.numPages && !cancelled; number += 1) {
          const page = await doc.getPage(number);
          const width = page.getViewport({ scale: 1 }).width;
          const canvas = await renderPage(page, (THUMB_WIDTH * density) / width);
          const jpeg = await canvasToBytes(canvas, "image/jpeg", 0.8);
          releaseCanvas(canvas);
          page.cleanup();
          if (cancelled) break;
          const url = URL.createObjectURL(new Blob([jpeg.slice()], { type: "image/jpeg" }));
          urls.push(url);
          setThumbs((current) => {
            const next = [...current];
            next[number - 1] = url;
            return next;
          });
        }
      } catch {
        // Thumbnails are a convenience: the pages can still be organised by number.
      } finally {
        await opened?.close();
      }
    })();

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
      setThumbs([]);
    };
  }, [bytes]);

  return thumbs;
}
