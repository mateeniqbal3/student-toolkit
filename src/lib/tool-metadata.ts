import type { Metadata } from "next";

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
