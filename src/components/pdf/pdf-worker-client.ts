/**
 * Runs PDF jobs in the pdf-lib worker, one promise per job.
 *
 * Inputs are copied into the worker rather than transferred, so the page can
 * keep using the file it sent (to preview it, or to run a second job); the
 * worker's output is transferred back without a copy. If a worker cannot be
 * started, the same code runs on the page instead: slower to respond, but it
 * still works.
 */
import type { AnyJobResult, JobResult, PdfJob } from "@/lib/pdf/jobs";
import { PDF_ERROR_REASONS, PdfError } from "@/lib/pdf/errors";
import type { WorkerRequest, WorkerResponse } from "@/workers/pdf.worker";

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (result: AnyJobResult) => void; reject: (error: Error) => void }
>();

function failAll(error: Error) {
  for (const job of pending.values()) job.reject(error);
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL("../../workers/pdf.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    workerFailed = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const job = pending.get(response.id);
    if (!job) return;
    pending.delete(response.id);
    if (response.ok) job.resolve(response.result);
    else {
      const reason = PDF_ERROR_REASONS.find((known) => known === response.reason);
      job.reject(reason ? new PdfError(reason) : new Error(response.reason));
    }
  };
  worker.onerror = () => {
    // A worker that crashes (often out of memory on a huge file) takes its
    // jobs with it; the next job starts a fresh one.
    failAll(new Error("worker-crashed"));
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export async function runPdfJob<J extends PdfJob>(job: J): Promise<JobResult<J>> {
  const target = getWorker();
  if (!target) {
    const { runJob } = await import("@/lib/pdf/jobs");
    // runJob returns the union of every job's result; for this job it is this job's.
    return (await runJob(job)) as JobResult<J>;
  }
  const id = nextId++;
  const result = await new Promise<AnyJobResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    target.postMessage({ id, job } satisfies WorkerRequest);
  });
  return result as JobResult<J>;
}
