/**
 * The models on offer, checked against the API in September 2026.
 *
 * Three is enough: fast, balanced and thorough. Model names change often, so
 * an unknown stored choice falls back to the default rather than failing.
 */

export interface AiModelOption {
  id: string;
  label: string;
  hint: string;
  /**
   * The least thinking this model will accept. Most take zero, which is the
   * quickest; gemini-3.5-flash-lite refuses a request asking for none and
   * has to be given a budget.
   */
  minThinkingBudget: number;
}

export const AI_MODELS: readonly AiModelOption[] = [
  {
    id: "gemini-3.5-flash-lite",
    label: "Fast",
    hint: "Quickest to answer, and the lightest on a free key's daily limit.",
    minThinkingBudget: 128,
  },
  {
    id: "gemini-3.6-flash",
    label: "Balanced",
    hint: "The default: quick, and strong enough for most study questions.",
    minThinkingBudget: 0,
  },
  {
    id: "gemini-3.8-flash",
    label: "Most capable",
    hint: "Best at long or tricky problems. Slower, and uses more of your daily limit.",
    minThinkingBudget: 0,
  },
];

export const DEFAULT_MODEL = "gemini-3.6-flash";

export function isKnownModel(id: string): boolean {
  return AI_MODELS.some((model) => model.id === id);
}

export function resolveModel(id: string): string {
  return isKnownModel(id) ? id : DEFAULT_MODEL;
}

/** A ceiling on one reply, so a runaway answer cannot eat a day's quota. */
export const MAX_OUTPUT_TOKENS = 4096;

/** What to ask this model for, given what the mode wants. */
export function thinkingBudgetFor(modelId: string, wanted: number): number {
  const model = AI_MODELS.find((option) => option.id === modelId);
  return Math.max(wanted, model?.minThinkingBudget ?? 0);
}
