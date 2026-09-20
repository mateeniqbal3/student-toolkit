"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TOOLS } from "@/lib/tools";
import { cn } from "@/lib/utils";

export function MobileNavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();

  // 44px minimum target: this is the primary navigation on a phone.
  const linkClass = (href: string) =>
    cn(
      "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
      "hover:bg-accent hover:text-accent-foreground",
      pathname === href && "bg-accent text-accent-foreground",
    );

  // Closing on click rather than on a pathname effect: the route change does
  // not unmount the sheet, so without this it stays open over the new page.
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(20rem,85vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tools</SheetTitle>
          <SheetDescription>
            Everything here works offline except the AI assistant.
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Tools" className="flex flex-col gap-1 px-4 pb-8">
          {TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              onClick={close}
              className={linkClass(`/${tool.slug}`)}
            >
              {tool.name}
            </Link>
          ))}
          <Link href="/about" onClick={close} className={cn("mt-2", linkClass("/about"))}>
            About
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
