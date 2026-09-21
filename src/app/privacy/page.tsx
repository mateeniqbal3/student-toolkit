import type { Metadata } from "next";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${siteConfig.name} stores, what it sends, and what it does not.`,
  alternates: { canonical: `${siteConfig.url}/privacy` },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The short version: your work stays on your device.
      </p>

      <div className="mt-6 flex flex-col gap-4 text-pretty">
        <h2 className="font-display text-xl font-semibold">What is stored</h2>
        <p>
          Your grades, notes, timetables, pomodoro history, citations and settings are saved in your
          own browser using IndexedDB and local storage. They are never transmitted anywhere.
          Clearing your browser data for this site deletes them permanently, so use the export and
          backup options if you want a copy.
        </p>

        <h2 className="font-display text-xl font-semibold">What leaves your device</h2>
        <p>Almost nothing. There are exactly three cases:</p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <strong>The AI assistant.</strong> When you send a message, that message is forwarded to
            a language model provider so it can answer. Nothing else from the app is included. If
            you supply your own API key, the request goes to the provider with your key.
          </li>
          <li>
            <strong>Currency rates.</strong> The unit converter fetches public exchange rates. That
            request contains no information about you.
          </li>
          <li>
            <strong>Citation lookups.</strong> If you paste a DOI, ISBN, arXiv or PubMed ID, that
            identifier is sent to the relevant public catalogue (doi.org, Crossref, DataCite, Open
            Library, Google Books or PubMed) to fetch the publication details. Your saved sources
            and the rest of your bibliography are never sent.
          </li>
        </ul>
        <p>
          PDF files are never uploaded. All PDF processing happens inside your browser, which is
          also why it keeps working with no connection.
        </p>

        <h2 className="font-display text-xl font-semibold">Analytics</h2>
        <p>
          Aggregate, cookie-free page-view counts may be collected to know which tools are used. No
          cookies are set, no profile is built, and nothing you type is recorded. There is no cookie
          banner because there are no tracking cookies to consent to.
        </p>

        <h2 className="font-display text-xl font-semibold">Accounts</h2>
        <p>
          There are none. Nothing asks for your name, email or student ID, so there is no account
          database to breach.
        </p>

        <h2 className="font-display text-xl font-semibold">Questions</h2>
        <p>
          The entire source is public at{" "}
          <a
            href={siteConfig.repository}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            GitHub
          </a>
          , so any of the above can be verified rather than taken on trust.
        </p>
      </div>
    </main>
  );
}
