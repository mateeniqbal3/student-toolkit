import * as React from "react";
import { cn } from "cn";

/**
 * A plain `<select>`, styled to match `Input`.
 *
 * The Radix select is better looking, but it costs bundle on a page that can
 * hold dozens of these, and on Android the native control opens the system
 * wheel picker — which is faster to use one-handed than any listbox rebuilt in
 * JavaScript. This is one of the places where the platform control wins.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 h-8 w-full min-w-0 appearance-none rounded-lg border bg-transparent py-1 ps-2.5 pe-7 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="text-muted-foreground pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export { NativeSelect };
