"use client";

import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Radix's dialog primitive costs roughly 33KB gzipped, which is a lot to spend
 * on every first visit for a menu most visitors never open. The trigger button
 * ships eagerly; the sheet itself is fetched on the first tap.
 */
const MobileNavSheet = dynamic(() =>
  import("./mobile-nav-sheet").then((module) => module.MobileNavSheet),
);

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      {requested ? <MobileNavSheet open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
