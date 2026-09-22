import type { MetadataRoute } from "next";

import { PDF_OPERATION_SLUGS } from "@/lib/pdf-tools";
import { siteConfig } from "@/lib/site-config";
import { TOOL_SLUGS } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteConfig.url, lastModified, changeFrequency: "weekly", priority: 1 },
    ...TOOL_SLUGS.map((slug) => ({
      url: `${siteConfig.url}/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Each PDF operation has its own page, because each is its own search.
    ...PDF_OPERATION_SLUGS.map((slug) => ({
      url: `${siteConfig.url}/pdf-tools/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...["about", "privacy"].map((slug) => ({
      url: `${siteConfig.url}/${slug}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
