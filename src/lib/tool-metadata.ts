import type { Metadata } from "next";

import { getPdfOperation } from "@/lib/pdf-tools";
import { siteConfig } from "@/lib/site-config";
import { getTool } from "@/lib/tools";

/**
 * Builds the metadata for a tool route from the registry, so the page title a
 * student sees in Google search results stays in step with the tool list.
 */
export function toolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  if (!tool) return {};

  const url = `${siteConfig.url}/${tool.slug}`;

  return {
    title: tool.name,
    description: tool.description,
    keywords: [...tool.keywords],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${tool.name} · ${siteConfig.name}`,
      description: tool.description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${tool.name} · ${siteConfig.name}`,
      description: tool.description,
    },
  };
}

/** Metadata for one PDF operation's own page, such as /pdf-tools/merge. */
export function pdfOperationMetadata(slug: string): Metadata {
  const operation = getPdfOperation(slug);
  if (!operation) return {};

  const url = `${siteConfig.url}/pdf-tools/${operation.slug}`;
  // What sets this apart in a results page full of upload sites.
  const title = `${operation.name} — free, nothing uploaded`;

  return {
    title,
    description: operation.description,
    keywords: [...operation.keywords],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${operation.name} · ${siteConfig.name}`,
      description: operation.description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${operation.name} · ${siteConfig.name}`,
      description: operation.description,
    },
  };
}
