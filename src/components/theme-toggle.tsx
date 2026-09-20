"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const index = ORDER.indexOf((theme ?? "system") as (typeof ORDER)[number]);
    setTheme(ORDER[(index + 1) % ORDER.length]);
  };

  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label="Change theme">
      {/*
        Both icons render and CSS picks one. The server cannot know the resolved
        theme, so choosing in JavaScript would either mismatch on hydration or
        need a mounted flag; letting the .dark class decide avoids both and is
        correct before hydration.
      */}
      <Sun className="size-5 dark:hidden" aria-hidden />
      <Moon className="hidden size-5 dark:block" aria-hidden />
    </Button>
  );
}
