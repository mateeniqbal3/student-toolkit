"use client";

import { FileUp } from "lucide-react";
import { useId, useMemo, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseCards, type CardText } from "@/lib/flashcards/transfer";

const DELIMITER_NAMES = { "\t": "tabs", ";": "semicolons", ",": "commas" } as const;

/**
 * Paste or open a file of front/back pairs. The file is read in the browser;
 * nothing is uploaded. A live count shows what will be added before anything
 * is, so a wrongly-guessed separator is caught before it makes 200 bad cards.
 */
export function ImportPanel({ onImport }: { onImport: (cards: CardText[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  const id = useId();

  const result = useMemo(() => (text.trim() ? parseCards(text) : null), [text]);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setAdded(null);
    event.target.value = "";
  }

  async function add() {
    if (!result || result.cards.length === 0) return;
    await onImport(result.cards);
    setAdded(result.cards.length);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm text-pretty">
        One card per line: the front, then a tab, comma or semicolon, then the back. In Anki, use
        File, Export, “Notes in Plain Text”. In Quizlet, use Export and copy the text.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-text`} className="text-muted-foreground text-xs">
          Cards to import
        </Label>
        <Textarea
          id={`${id}-text`}
          className="min-h-28 font-mono text-sm"
          placeholder={
            "mitochondria\tpowerhouse of the cell\nosmosis\twater moving across a membrane"
          }
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setAdded(null);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <label htmlFor={`${id}-file`} className="cursor-pointer">
            <FileUp className="size-4" aria-hidden />
            Open a file
          </label>
        </Button>
        <input
          id={`${id}-file`}
          type="file"
          accept=".txt,.tsv,.csv,text/plain,text/csv,text/tab-separated-values"
          className="sr-only"
          onChange={(event) => void readFile(event)}
        />
        <Button disabled={!result || result.cards.length === 0} onClick={() => void add()}>
          {result && result.cards.length > 0
            ? `Add ${result.cards.length} ${result.cards.length === 1 ? "card" : "cards"}`
            : "Add cards"}
        </Button>
      </div>

      <p role="status" className="text-muted-foreground text-xs">
        {added !== null
          ? `Added ${added} ${added === 1 ? "card" : "cards"}.`
          : result
            ? `Found ${result.cards.length} ${result.cards.length === 1 ? "card" : "cards"}, separated by ${DELIMITER_NAMES[result.delimiter]}${
                result.skipped > 0
                  ? `. ${result.skipped} ${result.skipped === 1 ? "line has" : "lines have"} no back and will be skipped`
                  : ""
              }.`
            : ""}
      </p>
    </div>
  );
}
