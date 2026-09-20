"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#tools", label: "Tools", match: "/" },
  { href: "/about", label: "About", match: "/about" },
] as const;

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium",
            pathname === link.match && "text-primary",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
