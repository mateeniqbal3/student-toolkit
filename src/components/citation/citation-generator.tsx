"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { draftFromItem, emptyDraft, itemFromDraft, type SourceDraft } from "@/lib/citation/draft";
import { findDuplicate } from "@/lib/citation/duplicates";
import { preloadCitationEngine } from "@/lib/citation/format";
import { CITATION_STYLES, DEFAULT_STYLE, isStyleId } from "@/lib/citation/styles";
import type { CslItem } from "@/lib/citation/types";
import {
  addCitation,
  addProject,
  deleteCitation,
  deleteProject,
  ensureFirstProject,
  projectCitations,
  renameProject,
  restoreCitation,
  setProjectStyle,
  updateCitation,
  type CitationProjectRecord,
  type CitationRecord,
} from "@/lib/db/citations";
import { db } from "@/lib/db/schema";

import { Bibliography } from "./bibliography";
import { SourceEditor } from "./source-editor";
import { SourceFinder } from "./source-finder";
import { useFormattedBibliography } from "./use-formatted-bibliography";

const PROJECT_STORAGE_KEY = "toolkit:citations:project";
const FIRST_PROJECT_NAME = "My bibliography";

type EditorState =
  | { mode: "new"; key: string; draft: SourceDraft }
  | { mode: "edit"; key: string; id: number; draft: SourceDraft };

export function CitationGenerator() {
  const [storedProjectId, setStoredProjectId] = useLocalStorage(PROJECT_STORAGE_KEY, "");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [lastDeleted, setLastDeleted] = useState<CitationRecord | null>(null);

  const projects = useLiveQuery(
    () =>
      db.citationProjects.toArray().then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt)),
    [],
  );
  const project = projects?.find((row) => String(row.id) === storedProjectId) ?? projects?.[0];
  const projectId = project?.id;
  const style = project && isStyleId(project.style) ? project.style : DEFAULT_STYLE;

  const records = useLiveQuery(
    () => (projectId === undefined ? [] : projectCitations(projectId)),
    [projectId],
  );
  const items = useMemo(() => records?.map((record) => record.item), [records]);
  const formatted = useFormattedBibliography(items, style);

  useEffect(() => {
    void ensureFirstProject(FIRST_PROJECT_NAME, DEFAULT_STYLE);
  }, []);

  // Start downloading the formatter as soon as the page is up, so the first
  // source a student adds is formatted without a visible wait.
  useEffect(() => {
    preloadCitationEngine(style);
  }, [style]);

  useEffect(() => {
    if (!lastDeleted) return;
    const timer = window.setTimeout(() => setLastDeleted(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [lastDeleted]);

  if (!projects || !project || !records || !items) return <LoadingState />;

  async function add(item: CslItem, force: boolean): Promise<boolean> {
    if (!project || !records) return false;
    if (!force && findDuplicate(records, item)) return false;
    await addCitation(project.id, item);
    return true;
  }

  async function save(draft: SourceDraft) {
    if (!project || !editor) return;
    if (editor.mode === "edit") {
      await updateCitation(editor.id, itemFromDraft(draft, String(editor.id)));
    } else {
      await addCitation(project.id, itemFromDraft(draft, crypto.randomUUID()));
    }
    setEditor(null);
  }

  function editEntry(id: string) {
    const record = records?.find((row) => String(row.id) === id);
    if (record) {
      setEditor({
        mode: "edit",
        key: crypto.randomUUID(),
        id: record.id,
        draft: draftFromItem(record.item),
      });
    }
  }

  async function removeEntry(id: string) {
    const record = await deleteCitation(Number(id));
    if (record) setLastDeleted(record);
    if (editor?.mode === "edit" && String(editor.id) === id) setEditor(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectBar
        projects={projects}
        project={project}
        sourceCount={records.length}
        onSelect={(id) => {
          setStoredProjectId(String(id));
          setEditor(null);
        }}
      />

      <SourceFinder
        style={style}
        onAdd={add}
        onEdit={(item) =>
          setEditor({ mode: "new", key: crypto.randomUUID(), draft: draftFromItem(item) })
        }
        onManual={() => setEditor({ mode: "new", key: crypto.randomUUID(), draft: emptyDraft() })}
      />

      {editor ? (
        <SourceEditor
          key={editor.key}
          initial={editor.draft}
          heading={editor.mode === "edit" ? "Edit source" : "New source"}
          submitLabel={editor.mode === "edit" ? "Save changes" : "Add to bibliography"}
          onSubmit={(draft) => void save(draft)}
          onCancel={() => setEditor(null)}
        />
      ) : null}

      {lastDeleted ? (
        <div
          role="status"
          className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1 truncate">Deleted “{lastDeleted.item.title}”.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void restoreCitation(lastDeleted);
              setLastDeleted(null);
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      <Bibliography
        projectName={project.name}
        style={style}
        items={items}
        formatted={formatted}
        onEdit={editEntry}
        onDelete={(id) => void removeEntry(id)}
      />
    </div>
  );
}

function ProjectBar({
  projects,
  project,
  sourceCount,
  onSelect,
}: {
  projects: CitationProjectRecord[];
  project: CitationProjectRecord;
  sourceCount: number;
  onSelect: (id: number) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const style = isStyleId(project.style) ? project.style : DEFAULT_STYLE;

  async function create() {
    const id = await addProject(`Bibliography ${projects.length + 1}`, style);
    onSelect(id);
    setRenaming(true);
  }

  async function remove() {
    const detail = sourceCount === 1 ? "its 1 source" : `its ${sourceCount} sources`;
    if (!window.confirm(`Delete “${project.name}” and ${detail}? This cannot be undone.`)) return;
    onSelect(await deleteProject(project.id, FIRST_PROJECT_NAME));
  }

  return (
    <section
      aria-label="Bibliography and style"
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]"
    >
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={renaming ? "project-name" : "project-select"}
          className="text-muted-foreground text-xs"
        >
          Bibliography
        </Label>
        <div className="flex gap-1">
          {renaming ? (
            <form
              className="flex min-w-0 flex-1 gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                setRenaming(false);
              }}
            >
              <Input
                id="project-name"
                className="h-9 min-w-0 flex-1"
                defaultValue={project.name}
                autoFocus
                onFocus={(event) => event.target.select()}
                onChange={(event) => {
                  const name = event.target.value.trim();
                  if (name) void renameProject(project.id, name);
                }}
                onBlur={() => setRenaming(false)}
              />
              <Button
                type="submit"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Done renaming"
                // Keeps focus in the input, so its blur does not unmount this
                // button before the click lands.
                onMouseDown={(event) => event.preventDefault()}
              >
                <Check className="size-4" aria-hidden />
              </Button>
            </form>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <NativeSelect
                  id="project-select"
                  className="h-9"
                  value={String(project.id)}
                  onChange={(event) => onSelect(Number(event.target.value))}
                >
                  {projects.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Rename this bibliography"
                onClick={() => setRenaming(true)}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label="New bibliography"
                onClick={() => void create()}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Delete this bibliography"
                onClick={() => void remove()}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="citation-style" className="text-muted-foreground text-xs">
          Citation style
        </Label>
        <NativeSelect
          id="citation-style"
          className="h-9"
          value={style}
          onChange={(event) => {
            if (isStyleId(event.target.value)) void setProjectStyle(project.id, event.target.value);
          }}
        >
          {CITATION_STYLES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} — {option.edition}
            </option>
          ))}
        </NativeSelect>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your saved bibliography</span>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
