"use client";

import { Building2, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  FIELD_HINTS,
  SOURCE_TYPES,
  blankName,
  draftProblems,
  fieldLabel,
  getSourceType,
  type DateDraft,
  type NameDraft,
  type SourceDraft,
  type TextField,
} from "@/lib/citation/draft";
import type { CslItemType } from "@/lib/citation/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Short fields sit two to a row from the small breakpoint up. */
const SHORT_FIELDS = new Set<TextField>(["volume", "issue", "page", "edition", "number"]);

/**
 * The form for typing in a source, or correcting one that was looked up.
 *
 * State stays local until Save: writing each keystroke to IndexedDB would
 * re-render the whole reference list as the student types.
 */
export function SourceEditor({
  initial,
  heading,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SourceDraft;
  heading: string;
  submitLabel: string;
  onSubmit: (draft: SourceDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [showProblems, setShowProblems] = useState(false);
  const id = useId();
  const sectionRef = useRef<HTMLElement>(null);

  // Editing an entry far down the list opens the form up here, so bring it
  // into view — on a phone it would otherwise open off-screen.
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    sectionRef.current?.querySelector<HTMLInputElement>("input[name='title']")?.focus({
      preventScroll: true,
    });
  }, []);

  const definition = getSourceType(draft.type);
  const problems = draftProblems(draft);

  function setText(field: TextField, value: string) {
    setDraft((current) => ({ ...current, text: { ...current.text, [field]: value } }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    onSubmit(draft);
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby={`${id}-heading`}
      className="bg-card ring-foreground/10 scroll-mt-20 rounded-xl p-4 ring-1"
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${id}-heading`} className="font-display font-semibold">
            {heading}
          </h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onCancel}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-type`} className="text-muted-foreground text-xs">
            Source type
          </Label>
          <NativeSelect
            id={`${id}-type`}
            className="h-9"
            value={draft.type}
            onChange={(event) =>
              setDraft((current) => ({ ...current, type: event.target.value as CslItemType }))
            }
          >
            {SOURCE_TYPES.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <TextInput
          id={`${id}-title`}
          name="title"
          label={fieldLabel(definition, "title")}
          value={draft.text.title}
          onChange={(value) => setText("title", value)}
          error={showProblems && problems.includes("missing-title") ? "A title is needed." : null}
        />

        <NameList
          legend="Authors"
          names={draft.authors}
          onChange={(authors) => setDraft((current) => ({ ...current, authors }))}
          personLabel="Add author"
          idPrefix={`${id}-author`}
        />

        {definition.editors ? (
          <NameList
            legend="Editors"
            names={draft.editors}
            onChange={(editors) => setDraft((current) => ({ ...current, editors }))}
            personLabel="Add editor"
            idPrefix={`${id}-editor`}
          />
        ) : null}

        <DateFields
          legend="Date published"
          idPrefix={`${id}-issued`}
          value={draft.issued}
          onChange={(issued) => setDraft((current) => ({ ...current, issued }))}
          error={
            showProblems && problems.includes("bad-year") ? "The year should be a number." : null
          }
          hint="Leave blank if there is none; styles print “n.d.”"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {definition.fields
            .filter((field) => field !== "title")
            .map((field) => (
              <div key={field} className={SHORT_FIELDS.has(field) ? "" : "sm:col-span-2"}>
                <TextInput
                  id={`${id}-${field}`}
                  name={field}
                  label={fieldLabel(definition, field)}
                  hint={FIELD_HINTS[field]}
                  value={draft.text[field]}
                  onChange={(value) => setText(field, value)}
                  inputMode={field === "URL" ? "url" : undefined}
                />
              </div>
            ))}
        </div>

        {definition.accessed ? (
          <DateFields
            legend="Date you read it"
            idPrefix={`${id}-accessed`}
            value={draft.accessed}
            onChange={(accessed) => setDraft((current) => ({ ...current, accessed }))}
            hint="Web pages change, so styles ask when you saw this version."
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{submitLabel}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

function TextInput({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  error,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  inputMode?: "url";
}) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        className="h-9"
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function NameList({
  legend,
  names,
  onChange,
  personLabel,
  idPrefix,
}: {
  legend: string;
  names: NameDraft[];
  onChange: (names: NameDraft[]) => void;
  personLabel: string;
  idPrefix: string;
}) {
  function update(key: string, patch: Partial<NameDraft>) {
    onChange(names.map((name) => (name.key === key ? { ...name, ...patch } : name)));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted-foreground mb-1.5 text-xs font-medium">{legend}</legend>

      {names.map((name, index) => {
        const position = `${legend.replace(/s$/, "")} ${index + 1}`;
        return (
          <div key={name.key} className="flex flex-wrap items-center gap-2">
            {name.kind === "organisation" ? (
              <Input
                id={`${idPrefix}-${name.key}-literal`}
                aria-label={`${position} organisation name`}
                placeholder="Organisation, e.g. World Health Organization"
                className="h-9 min-w-0 flex-1"
                value={name.literal}
                onChange={(event) => update(name.key, { literal: event.target.value })}
              />
            ) : (
              <>
                <Input
                  aria-label={`${position} first names`}
                  placeholder="First names"
                  className="h-9 min-w-0 flex-1 basis-0"
                  value={name.given}
                  onChange={(event) => update(name.key, { given: event.target.value })}
                />
                <Input
                  aria-label={`${position} last name`}
                  placeholder="Last name"
                  className="h-9 min-w-0 flex-1 basis-0"
                  value={name.family}
                  onChange={(event) => update(name.key, { family: event.target.value })}
                />
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={`Remove ${position.toLowerCase()}`}
              onClick={() => onChange(names.filter((candidate) => candidate.key !== name.key))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...names, blankName("person")])}
        >
          <UserRound className="size-3.5" aria-hidden />
          {personLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...names, blankName("organisation")])}
        >
          <Building2 className="size-3.5" aria-hidden />
          Add organisation
        </Button>
      </div>
    </fieldset>
  );
}

function DateFields({
  legend,
  idPrefix,
  value,
  onChange,
  error,
  hint,
}: {
  legend: string;
  idPrefix: string;
  value: DateDraft;
  onChange: (value: DateDraft) => void;
  error?: string | null;
  hint?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-muted-foreground mb-1.5 text-xs font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${idPrefix}-year`}
          aria-label={`${legend}: year`}
          placeholder="Year"
          inputMode="numeric"
          className="h-9 w-24"
          value={value.year}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange({ ...value, year: event.target.value })}
        />
        <div className="min-w-0 flex-1 basis-32">
          <NativeSelect
            aria-label={`${legend}: month`}
            className="h-9"
            value={value.month}
            onChange={(event) => onChange({ ...value, month: event.target.value })}
          >
            <option value="">Month</option>
            {MONTH_NAMES.map((month, index) => (
              <option key={month} value={String(index + 1)}>
                {month}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Input
          aria-label={`${legend}: day`}
          placeholder="Day"
          inputMode="numeric"
          className="h-9 w-20"
          value={value.day}
          onChange={(event) => onChange({ ...value, day: event.target.value })}
        />
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </fieldset>
  );
}
