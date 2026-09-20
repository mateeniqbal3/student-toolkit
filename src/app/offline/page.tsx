import { CloudOff } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
        <CloudOff className="size-6" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-semibold">You are offline</h1>
      <p className="text-muted-foreground text-pretty">
        This page has not been opened before, so it is not saved on your device yet. Tools you have
        already visited still work, and everything you saved is untouched.
      </p>
      <Button asChild>
        <Link href="/">Go to the tools</Link>
      </Button>
    </main>
  );
}
