import Link from "next/link";

import { GitHubIcon } from "@/components/icons";

import { siteConfig } from "@/lib/site-config";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-foreground font-medium">Free forever.</span> No account, no ads, no
          tracking.
        </p>

        <nav aria-label="Footer" className="flex items-center gap-4">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a
            href={siteConfig.repository}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1.5"
          >
            <GitHubIcon className="size-4" aria-hidden />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
