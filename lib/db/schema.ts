import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";

// ── Enums ──

export const runStatusEnum = pgEnum("run_status", [
  "draft",
  "queued",
  "running",
  "awaiting_confirmation",
  "failed",
  "partial",
  "completed",
]);

export const sourceOriginEnum = pgEnum("source_origin", [
  "uploaded",
  "discovered",
]);

export const parseStatusEnum = pgEnum("parse_status", [
  "pending",
  "parsed",
  "failed",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "overview",
  "synthesis",
  "claims",
  "gaps",
  "next_steps",
  "source_summary",
]);

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "agent",
]);

export const llmProviderEnum = pgEnum("llm_provider", [
  "openai_auth",
]);

// ── Users ──

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 255 }).notNull(),
  organization: varchar("organization", { length: 255 }),
  authProvider: varchar("auth_provider", { length: 50 })
    .default("openai_auth")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── User LLM Credentials ──

export const userLlmCredentials = pgTable("user_llm_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  provider: llmProviderEnum("provider").notNull(),
  encryptedTokens: text("encrypted_tokens").notNull(),
  validationStatus: varchar("validation_status", { length: 20 })
    .default("invalid")
    .notNull(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  capabilities: jsonb("capabilities")
    .$type<{
      basic: boolean;
      json: boolean;
      streaming: boolean;
      toolCalling: boolean;
      liteModel: boolean;
    }>()
    .notNull(),
  lastErrorCode: integer("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Projects (workspaces) ──

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  status: runStatusEnum("status").default("queued").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Runs ──

export const runs = pgTable("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  status: runStatusEnum("status").default("queued").notNull(),
  currentStep: varchar("current_step", { length: 100 }).default(""),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Intermediate data stored as jsonb for dev transparency
  evidenceMap: jsonb("evidence_map"),
  consolidatedFindings: jsonb("consolidated_findings"),
});

// ── User inputs ──

export const userInputs = pgTable("user_inputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  researchQuestion: text("research_question").notNull(),
  researchIntent: text("research_intent"),
  workingHypothesis: text("working_hypothesis"),
  scopeBoundaries: text("scope_boundaries"),
  mustAnswerQuestions: jsonb("must_answer_questions").$type<string[]>(),
  audience: varchar("audience", { length: 255 }),
  geography: varchar("geography", { length: 255 }),
  timeHorizon: varchar("time_horizon", { length: 255 }),
  outputLanguage: varchar("output_language", { length: 50 }),
});

// ── Sources ──

export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  origin: sourceOriginEnum("origin").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  checksum: varchar("checksum", { length: 128 }),
  storagePath: text("storage_path"),
  parseStatus: parseStatusEnum("parse_status").default("pending").notNull(),
  parsedContent: text("parsed_content"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sourceChunks = pgTable("source_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .references(() => sources.id, { onDelete: "cascade" })
    .notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  headingPath: text("heading_path").notNull(),
  tokenEstimate: integer("token_estimate").notNull(),
  blobKey: text("blob_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Perspectives ──

export const perspectives = pgTable("perspectives", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  briefSummary: text("brief_summary").notNull(),
  interpretedIntent: text("interpreted_intent").notNull(),
  inferredResearchFrame: text("inferred_research_frame").notNull(),
  evidenceForCriteria: jsonb("evidence_for_criteria").$type<string[]>().notNull(),
  evidenceAgainstCriteria: jsonb("evidence_against_criteria").$type<string[]>().notNull(),
  subquestions: jsonb("subquestions").$type<string[]>().notNull(),
});

// ── Artifacts ──

export const artifacts = pgTable("artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  type: artifactTypeEnum("type").notNull(),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Chat sessions ──

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => chatSessions.id, { onDelete: "cascade" })
    .notNull(),
  role: chatMessageRoleEnum("role").notNull(),
  text: text("text").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Papers (LaTeX documents authored from workspace) ──

export const papers = pgTable("papers", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Notes (user-created markdown files in workspace) ──

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  folder: text("folder"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Experiments (structured experiment designs) ──

export const experiments = pgTable("experiments", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Run errors ──

export const runErrors = pgTable("run_errors", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  step: varchar("step", { length: 100 }).notNull(),
  message: text("message").notNull(),
  retryable: boolean("retryable").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
