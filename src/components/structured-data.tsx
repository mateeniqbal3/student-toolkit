import { siteConfig } from "@/lib/site-config";
import { TOOLS } from "@/lib/tools";

/**
 * JSON-LD describing the app. Search engines use this for the rich result on
 * the landing page, which is where most students will arrive from.
 */
export function StructuredData() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: TOOLS.map((tool) => tool.name),
    inLanguage: siteConfig.locale,
    license: "https://opensource.org/licenses/MIT",
  };

  return (
    <script
      type="application/ld+json"
      // The payload is built from local constants, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
