/**
 * Typed accessors for the pomodoro task list and focus history.
 */
import type { FocusRecord } from "@/lib/pomodoro/timer";

import { db, type PomodoroSessionRecord, type TaskRecord } from "./schema";

export async function addTask(title: string, estimate: number | null): Promise<number> {
  const now = Date.now();
  return db.tasks.add({
    title,
    estimate,
    pomodoros: 0,
    doneAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function setTaskDone(id: number, done: boolean): Promise<void> {
  const now = Date.now();
  await db.tasks.update(id, { doneAt: done ? now : null, updatedAt: now });
}

/** Returns the deleted task, so the page can offer to put it back. */
export async function deleteTask(id: number): Promise<TaskRecord | undefined> {
  return db.transaction("rw", db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (task) await db.tasks.delete(id);
    return task;
  });
}

export async function restoreTask(task: TaskRecord): Promise<void> {
  await db.tasks.put(task);
}

export async function clearDoneTasks(): Promise<void> {
  const done = await db.tasks.filter((task) => task.doneAt !== null).primaryKeys();
  await db.tasks.bulkDelete(done);
}

/**
 * Saves focus that ended, crediting full pomodoros to the task being worked on.
 *
 * Two open tabs both see the same phase end and both try to save it. A session
 * is identified by the moment it started, so the second save finds the first
 * inside the same transaction and does nothing.
 */
export async function recordFocus(
  records: readonly FocusRecord[],
  taskId: number | null,
): Promise<void> {
  if (records.length === 0) return;
  await db.transaction("rw", db.pomodoroSessions, db.tasks, async () => {
    for (const record of records) {
      const existing = await db.pomodoroSessions
        .where("startedAt")
        .equals(record.startedAt)
        .count();
      if (existing > 0) continue;

      const task = taskId === null ? undefined : await db.tasks.get(taskId);
      await db.pomodoroSessions.add({ ...record, taskId: task ? task.id : null });
      if (task && record.completed) {
        await db.tasks.update(task.id, { pomodoros: task.pomodoros + 1 });
      }
    }
  });
}

export function sessionsBetween(from: number, to: number): Promise<PomodoroSessionRecord[]> {
  return db.pomodoroSessions.where("startedAt").between(from, to, true, false).toArray();
}

export async function clearHistory(): Promise<void> {
  await db.pomodoroSessions.clear();
}

export type { PomodoroSessionRecord, TaskRecord };
