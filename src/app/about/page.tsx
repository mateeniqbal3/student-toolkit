import type { Metadata } from "next";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About",
  description: `Why ${siteConfig.name} exists, who it is for, and how it stays free.`,
  alternates: { canonical: `${siteConfig.url}/about` },
};

export default function AboutPage() {
  return (
    <main className="prose-gap mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">About</h1>

      <div className="mt-6 flex flex-col gap-4 text-pretty">
        <p>
          {siteConfig.name} is a free collection of ten tools for university students, built to work
          on a cheap phone with a bad connection.
        </p>
        <p>
          Most student calculators are single-purpose pages covered in ads that need a good
          connection and quietly upload whatever you type into them. This is one app instead of ten
          tabs, and everything except the AI assistant runs entirely inside your browser.
        </p>

        <h2 className="font-display mt-4 text-xl font-semibold">How it stays free</h2>
        <p>
          There is no server doing the work and no database storing your files, so there is almost
          nothing to pay for. The site is static, the hosting is a free tier, and the code is open
          source under the MIT license. No ads, no accounts, no analytics that follow you around.
        </p>

        <h2 className="font-display mt-4 text-xl font-semibold">A note on the AI assistant</h2>
        <p>
          The AI assistant is a study aid, not a way to have your assignments written for you.
          Submitting generated text as your own work is plagiarism at every university worth
          attending. Use it to understand something, then write it yourself.
        </p>

        <h2 className="font-display mt-4 text-xl font-semibold">Contributing</h2>
        <p>
          Bug reports and contributions are welcome on{" "}
          <a
            href={siteConfig.repository}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            GitHub
          </a>
          . Translations, especially Urdu, are particularly useful.
        </p>
      </div>
    </main>
  );
}
