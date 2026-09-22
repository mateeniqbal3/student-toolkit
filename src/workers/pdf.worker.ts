/**
 * The PDF worker: pdf-lib runs here so merging, splitting or stamping a large
 * file never freezes the page. Each message is one job; the reply carries the
 * job's id, and its output bytes are transferred rather than copied.
 */
import { runJob, resultBuffers, type PdfJob } from "@/lib/pdf/jobs";
import { PdfError } from "@/lib/pdf/errors";

export interface WorkerRequest {
  id: number;
  job: PdfJob;
}

export type WorkerResponse =
  | { id: number; ok: true; result: Awaited<ReturnType<typeof runJob>> }
  | { id: number; ok: false; reason: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const { id, job } = event.data;
  runJob(job).then(
    (result) => scope.postMessage({ id, ok: true, result }, resultBuffers(result)),
    (error: unknown) =>
      scope.postMessage({
        id,
        ok: false,
        reason: error instanceof PdfError ? error.reason : "failed",
      }),
  );
};
