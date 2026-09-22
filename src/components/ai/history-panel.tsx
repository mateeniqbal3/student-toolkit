"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearConversations, deleteConversation, type AiConversationRecord } from "@/lib/db/ai";
import { MODES, getMode } from "@/lib/ai/modes";
import { cn } from "@/lib/utils";

/** Past chats, kept on the device, so a revision session can be picked up again. */
export function HistoryPanel({
  conversations,
  currentId,
  onOpen,
}: {
  conversations: AiConversationRecord[];
  currentId: number | null;
  onOpen: (conversation: AiConversationRecord) => void;
}) {
  if (conversations.length === 0) return null;

  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Earlier chats ({conversations.length})
      </summary>
      <div className="flex flex-col gap-2 border-t p-3">
        <ul aria-label="Earlier chats" className="flex flex-col">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className="flex items-center gap-2 border-b py-1.5 last:border-b-0"
            >
              <button
                type="button"
                className={cn(
                  "min-w-0 flex-1 truncate text-start text-sm",
                  conversation.id === currentId && "font-semibold",
                )}
                onClick={() => onOpen(conversation)}
              >
                {conversation.title}
                <span className="text-muted-foreground ms-2 text-xs">
                  {MODES[getMode(conversation.mode).id].label}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete chat ${conversation.title}`}
                onClick={() => void deleteConversation(conversation.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => {
            if (window.confirm("Delete every saved chat? This cannot be undone.")) {
              void clearConversations();
            }
          }}
        >
          Clear all chats
        </Button>
      </div>
    </details>
  );
}
