import { AiError, type AiErrorReason } from "@/lib/ai/gemini";

/** What went wrong, and what the student can do about it. */
const MESSAGES: Record<AiErrorReason, string> = {
  "no-key": "Add your Gemini key to use the assistant.",
  "bad-key":
    "Google refused this key. Check it in AI Studio, or paste it again in the assistant's settings.",
  quota:
    "Your key has hit Google's free limit for now. Wait a minute and try again, or switch to the Fast model in settings, which uses less.",
  busy: "Google's servers are busy. Try that again in a moment.",
  blocked:
    "Google's safety filters stopped this answer. Rephrasing the question usually gets past it.",
  offline: "No connection to Google. The assistant is the one tool here that needs the internet.",
  cancelled: "Stopped.",
  failed: "Something went wrong talking to Google. Please try again.",
};

export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiError) return MESSAGES[error.reason];
  return MESSAGES.failed;
}

/** Google's own wording, worth showing under ours when it says something specific. */
export function aiErrorDetail(error: unknown): string | undefined {
  return error instanceof AiError ? error.detail : undefined;
}
