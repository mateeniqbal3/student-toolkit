import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
        <Compass className="size-6" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground text-pretty">
        That page does not exist. It may have moved, or the link may be wrong.
      </p>
      <Button asChild>
        <Link href="/">See all nine tools</Link>
      </Button>
    </main>
  );
}
