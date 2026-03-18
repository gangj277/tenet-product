/** Primary model — strong reasoning for critical pipeline steps */
export const MODEL = "google/gemini-3-flash-preview" as const;

/** Light model — secondary artifacts (overview, claims, gaps, next-steps) */
export const MODEL_LIGHT = "google/gemini-3.1-flash-lite-preview" as const;

/** Lite model — high-volume simple tasks (source summaries, PDF extraction) */
export const MODEL_LITE = "google/gemini-2.5-flash-lite" as const;

/** Agent model — workspace agent ReAct loop */
export const MODEL_AGENT = "google/gemini-3-flash-preview" as const;
