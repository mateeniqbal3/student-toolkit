import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";

import { ToolShell } from "@/components/tool-shell";
import { PDF_OPERATION_SLUGS, getPdfOperation, type PdfOperationSlug } from "@/lib/pdf-tools";
import { PDF_OPERATION_ICONS } from "@/lib/tool-icons";
import { pdfOperationMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

/**
 * Each operation's panel is its own chunk, so the merge page does not carry
 * the organiser's code, and none of them carries pdf-lib or pdf.js, which
 * load when a file is chosen.
 */
const PANELS: Record<PdfOperationSlug, ComponentType> = {
  merge: dynamic(() => import("@/components/pdf/merge-panel").then((m) => m.MergePanel)),
  split: dynamic(() => import("@/components/pdf/split-panel").then((m) => m.SplitPanel)),
  organize: dynamic(() => import("@/components/pdf/organize-panel").then((m) => m.OrganizePanel)),
  compress: dynamic(() => import("@/components/pdf/compress-panel").then((m) => m.CompressPanel)),
  "images-to-pdf": dynamic(() =>
    import("@/components/pdf/images-panel").then((m) => m.ImagesPanel),
  ),
  "pdf-to-images": dynamic(() =>
    import("@/components/pdf/to-images-panel").then((m) => m.ToImagesPanel),
  ),
  "extract-text": dynamic(() => import("@/components/pdf/text-panel").then((m) => m.TextPanel)),
  "page-numbers": dynamic(() =>
    import("@/components/pdf/page-numbers-panel").then((m) => m.PageNumbersPanel),
  ),
  watermark: dynamic(() =>
    import("@/components/pdf/watermark-panel").then((m) => m.WatermarkPanel),
  ),
};

/** Every operation is built at deploy time; anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_OPERATION_SLUGS.map((operation) => ({ operation }));
}

export async function generateMetadata({ params }: PageProps<"/pdf-tools/[operation]">) {
  const { operation } = await params;
  return pdfOperationMetadata(operation);
}

export default async function Page({ params }: PageProps<"/pdf-tools/[operation]">) {
  const { operation: slug } = await params;
  const tool = getTool("pdf-tools");
  const operation = getPdfOperation(slug);
  if (!tool || !operation) notFound();

  const Panel = PANELS[operation.slug];

  return (
    <ToolShell
      tool={tool}
      heading={{
        title: operation.name,
        tagline: operation.tagline,
        icon: PDF_OPERATION_ICONS[operation.slug],
      }}
      back={{ href: "/pdf-tools", label: "All PDF tools" }}
    >
      <Panel />
    </ToolShell>
  );
}
