/** Primary model — strong reasoning for critical pipeline steps */
export const MODEL = "gpt-5.4" as const;

/** Intent model — fast, structured perspective inference before the main pipeline */
export const MODEL_INTENT = "gpt-5.4-mini" as const;

/** Light model — secondary artifacts (overview, claims, gaps, next-steps) */
export const MODEL_LIGHT = "gpt-5.4" as const;

/** Lite model — high-volume simple tasks (source summaries, PDF extraction) */
export const MODEL_LITE = "gpt-5.4-mini" as const;

/** Agent model — workspace agent ReAct loop */
export const MODEL_AGENT = "gpt-5.4" as const;
