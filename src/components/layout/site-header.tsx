import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="bg-background/85 sticky top-0 z-50 border-b backdrop-blur-sm print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <GraduationCap className="text-primary size-6" aria-hidden />
          <span>{siteConfig.name}</span>
        </Link>

        <div className="flex-1" />

        <MainNav />
        <ThemeToggle />
        <MobileNav />
      </div>
    </header>
  );
}
