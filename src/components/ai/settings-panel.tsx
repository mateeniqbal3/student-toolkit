"use client";

import { ExternalLink, KeyRound } from "lucide-react";

import { ChoiceGroup } from "@/components/choice-group";
import { Button } from "@/components/ui/button";
import { AI_MODELS } from "@/lib/ai/models";

const MODEL_OPTIONS = AI_MODELS.map((model) => ({ value: model.id, label: model.label }));

export function SettingsPanel({
  model,
  onModelChange,
  onKeyCleared,
}: {
  model: string;
  onModelChange: (model: string) => void;
  onKeyCleared: () => void;
}) {
  const current = AI_MODELS.find((option) => option.id === model);

  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Assistant settings
      </summary>
      <div className="flex flex-col gap-4 border-t p-3">
        <div className="flex flex-col gap-1.5">
          <ChoiceGroup
            label="Model"
            options={MODEL_OPTIONS}
            value={model}
            onChange={onModelChange}
          />
          <p className="text-muted-foreground text-xs text-pretty">{current?.hint}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs text-pretty">
            Your key is stored in this browser only. Removing it stops the assistant until you add
            one again; nothing else in the toolkit is affected.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm("Remove your Gemini key from this browser?")) onKeyCleared();
              }}
            >
              <KeyRound className="size-3.5" aria-hidden />
              Remove key
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage keys in AI Studio
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}
