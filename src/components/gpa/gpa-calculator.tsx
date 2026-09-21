"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, Plus, RotateCcw, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { ScaleReference } from "@/components/gpa/scale-reference";
import { TargetSolver } from "@/components/gpa/target-solver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  addCourse,
  addSemester,
  clearSemesters,
  deleteSemester,
  ensureFirstSemester,
  removeCourse,
  renameSemester,
  updateCourse,
} from "@/lib/db/gpa";
import { db, type SemesterRecord } from "@/lib/db/schema";
import { calculateCgpa, formatPoints, type Course } from "@/lib/gpa/calculate";
import {
  BUILT_IN_SCALES,
  DEFAULT_SCALE_ID,
  customScaleId,
  getBuiltInScale,
  parseCustomScaleId,
  type GradingScale,
} from "@/lib/gpa/scales";

/**
 * The editor is behind a dynamic import because most students use a built-in
 * scale and never open it, and it is the only thing on this page that pulls in
 * a modal dialog.
 */
const CustomScaleEditor = dynamic(
  () => import("@/components/gpa/custom-scale-editor").then((module) => module.CustomScaleEditor),
  { ssr: false },
);

const SCALE_STORAGE_KEY = "toolkit:gpa:scale";

export function GpaCalculator() {
  const [scaleId, setScaleId] = useLocalStorage(SCALE_STORAGE_KEY, DEFAULT_SCALE_ID);
  const [editorOpen, setEditorOpen] = useState(false);

  const semesters = useLiveQuery(() => db.semesters.orderBy("order").toArray(), []);
  const customScales = useLiveQuery(() => db.gradingScales.toArray(), []);

  useEffect(() => {
    void ensureFirstSemester();
  }, []);

  const scale = useResolvedScale(scaleId, customScales);

  const cgpa = useMemo(
    () =>
      calculateCgpa(
        (semesters ?? []).map((record) => ({
          id: String(record.id),
          name: record.name,
          courses: record.courses,
        })),
        scale,
      ),
    [semesters, scale],
  );

  if (semesters === undefined) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="scale-heading" className="flex flex-col gap-2">
        <h2 id="scale-heading" className="font-display text-sm font-semibold">
          Grading scale
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="Grading scale"
            className="h-9 w-full sm:w-72"
            value={scaleId}
            onChange={(event) => setScaleId(event.target.value)}
          >
            {BUILT_IN_SCALES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            {(customScales ?? []).map((record) => (
              <option key={record.id} value={customScaleId(record.id)}>
                {record.name} (yours)
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            Custom scale
          </Button>
        </div>
        <p className="text-muted-foreground text-sm text-pretty">{scale.description}</p>
      </section>

      {editorOpen ? (
        <CustomScaleEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={(savedId) => setScaleId(customScaleId(savedId))}
        />
      ) : null}

      <Summary cgpa={cgpa} scale={scale} semesters={semesters} />

      <section aria-labelledby="semesters-heading" className="flex flex-col gap-4">
        <h2 id="semesters-heading" className="sr-only">
          Semesters
        </h2>

        {semesters.map((semester, index) => (
          <SemesterCard
            key={semester.id}
            semester={semester}
            scale={scale}
            gpa={cgpa.semesters[index]?.result.gpa ?? null}
            credits={cgpa.semesters[index]?.result.totalCredits ?? 0}
          />
        ))}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void addSemester()}>
            <Plus className="size-4" aria-hidden />
            Add semester
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("Clear every semester and start again?")) void clearSemesters();
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            Start over
          </Button>
        </div>
      </section>

      <TargetSolver
        currentCgpa={cgpa.gpa}
        completedCredits={cgpa.totalCredits}
        scaleMax={scale.max}
      />

      <ScaleReference scale={scale} />
    </div>
  );
}

/**
 * Turns the stored scale id into a usable scale, falling back to the default
 * when a custom scale has been deleted since it was chosen.
 */
function useResolvedScale(
  scaleId: string,
  customScales:
    { id: number; name: string; max: number; grades: GradingScale["grades"] }[] | undefined,
): GradingScale {
  return useMemo(() => {
    const fallback = getBuiltInScale(DEFAULT_SCALE_ID) ?? BUILT_IN_SCALES[0];
    const customId = parseCustomScaleId(scaleId);

    if (customId !== null) {
      const record = (customScales ?? []).find((candidate) => candidate.id === customId);
      if (!record) return fallback;
      return {
        id: scaleId,
        name: record.name,
        description: "Your own scale, stored in this browser.",
        max: record.max,
        mode: "letter",
        grades: record.grades,
      };
    }

    return getBuiltInScale(scaleId) ?? fallback;
  }, [scaleId, customScales]);
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your saved semesters</span>
      <Skeleton className="h-9 w-full sm:w-72" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function Summary({
  cgpa,
  scale,
  semesters,
}: {
  cgpa: ReturnType<typeof calculateCgpa>;
  scale: GradingScale;
  semesters: SemesterRecord[];
}) {
  const [copied, setCopied] = useState(false);

  const unit = scale.mode === "percentage" ? "%" : ` / ${scale.max}`;

  async function copySummary() {
    const lines = [
      `Transcript summary — ${scale.name}`,
      "",
      ...semesters.flatMap((semester, index) => {
        const result = cgpa.semesters[index]?.result;
        return [
          `${semester.name} — GPA ${formatPoints(result?.gpa ?? null)} over ${result?.totalCredits ?? 0} credits`,
          ...semester.courses
            .filter((course) => course.grade.trim() !== "")
            .map(
              (course) =>
                `  ${course.name.trim() === "" ? "Untitled course" : course.name} · ${course.credits} cr · ${course.grade}`,
            ),
          "",
        ];
      }),
      `CGPA ${formatPoints(cgpa.gpa)} over ${cgpa.totalCredits} credits`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied, or an insecure origin. Nothing useful to
      // say beyond leaving the button as it was.
    }
  }

  return (
    <section
      aria-labelledby="summary-heading"
      className="bg-card ring-foreground/10 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl p-4 ring-1"
    >
      <h2 id="summary-heading" className="sr-only">
        Results
      </h2>

      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Cumulative
        </p>
        <p
          className="font-display text-primary text-3xl font-semibold tabular-nums"
          aria-live="polite"
        >
          {formatPoints(cgpa.gpa)}
          <span className="text-muted-foreground ms-1 text-base font-normal">{unit}</span>
        </p>
      </div>

      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Credits</p>
        <p className="font-display text-3xl font-semibold tabular-nums">{cgpa.totalCredits}</p>
      </div>

      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Courses</p>
        <p className="font-display text-3xl font-semibold tabular-nums">{cgpa.countedCourses}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="ms-auto"
        onClick={() => void copySummary()}
        disabled={cgpa.gpa === null}
      >
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {copied ? "Copied" : "Copy summary"}
      </Button>
    </section>
  );
}

function SemesterCard({
  semester,
  scale,
  gpa,
  credits,
}: {
  semester: SemesterRecord;
  scale: GradingScale;
  gpa: number | null;
  credits: number;
}) {
  return (
    <section
      aria-label={semester.name}
      className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1"
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label="Semester name"
          className="font-display h-9 max-w-56 border-transparent bg-transparent font-semibold shadow-none"
          defaultValue={semester.name}
          onChange={(event) => void renameSemester(semester.id, event.target.value)}
        />

        <p className="text-muted-foreground ms-auto text-sm tabular-nums">
          GPA <span className="text-foreground font-semibold">{formatPoints(gpa)}</span>
          <span className="ms-2">{credits} cr</span>
        </p>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${semester.name}`}
          onClick={() => void deleteSemester(semester.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {semester.courses.map((course, index) => (
          <li key={course.id}>
            <CourseRow
              course={course}
              index={index}
              scale={scale}
              semesterId={semester.id}
              canRemove={semester.courses.length > 1}
            />
          </li>
        ))}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => void addCourse(semester.id)}
      >
        <Plus className="size-4" aria-hidden />
        Add course
      </Button>
    </section>
  );
}

function CourseRow({
  course,
  index,
  scale,
  semesterId,
  canRemove,
}: {
  course: Course;
  index: number;
  scale: GradingScale;
  semesterId: number;
  canRemove: boolean;
}) {
  const position = index + 1;

  return (
    // Wrapping rather than a grid: at 360px the name takes the full width and
    // the three small controls sit together on the line below, with no
    // horizontal scroll and nothing squeezed under a thumb.
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={`Course ${position} name`}
        placeholder={`Course ${position}`}
        className="h-9 w-full sm:w-auto sm:flex-1"
        defaultValue={course.name}
        onChange={(event) => void updateCourse(semesterId, course.id, { name: event.target.value })}
      />

      <Input
        aria-label={`Course ${position} credit hours`}
        className="h-9 w-20"
        type="number"
        inputMode="decimal"
        min={0}
        max={30}
        step={0.5}
        placeholder="Cr"
        defaultValue={course.credits === 0 ? "" : course.credits}
        onChange={(event) => {
          const credits = Number(event.target.value);
          void updateCourse(semesterId, course.id, {
            credits: Number.isFinite(credits) && credits >= 0 ? credits : 0,
          });
        }}
      />

      {scale.mode === "percentage" ? (
        <Input
          aria-label={`Course ${position} marks out of 100`}
          className="h-9 w-24 flex-1 sm:flex-none"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          placeholder="Marks"
          defaultValue={course.grade}
          onChange={(event) =>
            void updateCourse(semesterId, course.id, { grade: event.target.value })
          }
        />
      ) : (
        <NativeSelect
          aria-label={`Course ${position} grade`}
          className="h-9 w-24 flex-1 sm:flex-none"
          value={course.grade}
          onChange={(event) =>
            void updateCourse(semesterId, course.id, { grade: event.target.value })
          }
        >
          <option value="">Grade</option>
          {scale.grades.map((grade) => (
            <option key={grade.letter} value={grade.letter}>
              {grade.letter} · {grade.points}
            </option>
          ))}
        </NativeSelect>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label={`Remove course ${position}`}
        disabled={!canRemove}
        onClick={() => void removeCourse(semesterId, course.id)}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
