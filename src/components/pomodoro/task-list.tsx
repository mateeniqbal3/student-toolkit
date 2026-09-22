"use client";

import { Crosshair, Plus, Timer, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addTask,
  clearDoneTasks,
  deleteTask,
  restoreTask,
  setTaskDone,
  type TaskRecord,
} from "@/lib/db/pomodoro";
import { cn } from "@/lib/utils";

/**
 * What the focus sessions are for. The current task collects a pomodoro for
 * every focus session finished while it is selected, so the count beside an
 * estimate shows how far off the guess was.
 */
export function TaskList({
  tasks,
  currentId,
  onSelect,
}: {
  tasks: TaskRecord[] | undefined;
  currentId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("");
  const [removed, setRemoved] = useState<TaskRecord | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [removed]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const count = Number.parseInt(estimate, 10);
    const id = await addTask(trimmed, Number.isSafeInteger(count) && count > 0 ? count : null);
    // Only clear what was saved, in case the next task is already being typed.
    setTitle((current) => (current === title ? "" : current));
    setEstimate((current) => (current === estimate ? "" : current));
    if (currentId === null) onSelect(id);
  }

  async function remove(task: TaskRecord) {
    const gone = await deleteTask(task.id);
    if (!gone) return;
    setRemoved(gone);
    if (task.id === currentId) onSelect(null);
  }

  const open = (tasks ?? []).filter((task) => task.doneAt === null);
  const done = (tasks ?? [])
    .filter((task) => task.doneAt !== null)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  return (
    <section aria-labelledby="tasks-heading" className="flex min-w-0 flex-col gap-3">
      <h2 id="tasks-heading" className="font-display font-semibold">
        Tasks
      </h2>

      <form className="flex flex-col gap-1.5" onSubmit={(event) => void add(event)}>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-task" className="text-muted-foreground text-xs">
              New task
            </Label>
            <Input
              id="new-task"
              className="h-9"
              placeholder="e.g. Chapter 4 problem set"
              autoComplete="off"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex w-20 shrink-0 flex-col gap-1.5">
            <Label htmlFor="new-task-estimate" className="text-muted-foreground text-xs">
              Pomodoros
            </Label>
            <Input
              id="new-task-estimate"
              className="h-9"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              placeholder="—"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
            />
          </div>
        </div>
        <Button type="submit" className="h-9 w-fit" disabled={!title.trim()}>
          <Plus className="size-4" aria-hidden />
          Add task
        </Button>
      </form>

      {removed ? (
        <div
          role="status"
          className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1 truncate">Deleted “{removed.title}”.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void restoreTask(removed);
              setRemoved(null);
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      {!tasks ? (
        <Skeleton className="h-16 w-full" />
      ) : open.length === 0 ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {done.length > 0
            ? "Everything is done. Add the next thing, or just focus."
            : "Add what you plan to work on. Each focus session finished counts towards the task you are working on."}
        </p>
      ) : (
        <ul className="flex flex-col" aria-label="Open tasks">
          {open.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              current={task.id === currentId}
              onSelect={() => onSelect(task.id)}
              onRemove={() => void remove(task)}
            />
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
            Done ({done.length})
          </summary>
          <div className="flex flex-col gap-2 border-t p-3">
            <ul className="flex flex-col" aria-label="Done tasks">
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  current={false}
                  onRemove={() => void remove(task)}
                />
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => void clearDoneTasks()}
            >
              Clear done tasks
            </Button>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function TaskRow({
  task,
  current,
  onSelect,
  onRemove,
}: {
  task: TaskRecord;
  current: boolean;
  onSelect?: () => void;
  onRemove: () => void;
}) {
  const isDone = task.doneAt !== null;
  const checkboxId = `task-${task.id}`;

  return (
    <li className="flex items-center gap-2 border-b py-2 last:border-b-0">
      <input
        id={checkboxId}
        type="checkbox"
        className="accent-primary size-5 shrink-0"
        checked={isDone}
        onChange={(event) => void setTaskDone(task.id, event.target.checked)}
      />
      <label
        htmlFor={checkboxId}
        className={cn(
          "min-w-0 flex-1 text-sm break-words",
          isDone && "text-muted-foreground line-through",
          current && "font-semibold",
        )}
      >
        {task.title}
        {current ? <span className="sr-only"> (current task)</span> : null}
      </label>
      <span
        className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums"
        title={
          task.estimate === null
            ? `${task.pomodoros} pomodoros`
            : `${task.pomodoros} of ${task.estimate} pomodoros`
        }
      >
        <Timer className="size-3.5" aria-hidden />
        <span className="sr-only">Pomodoros: </span>
        {task.estimate === null ? task.pomodoros : `${task.pomodoros}/${task.estimate}`}
      </span>
      {onSelect && !current ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Work on ${task.title}`}
          title="Work on this"
          onClick={onSelect}
        >
          <Crosshair className="size-4" aria-hidden />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete task ${task.title}`}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
