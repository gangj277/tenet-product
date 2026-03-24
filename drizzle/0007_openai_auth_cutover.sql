ALTER TYPE "public"."llm_provider" RENAME TO "llm_provider_old";
CREATE TYPE "public"."llm_provider" AS ENUM('openai_auth');

ALTER TABLE "user_llm_credentials"
  ALTER COLUMN "provider" TYPE "public"."llm_provider"
  USING 'openai_auth'::"public"."llm_provider";

DROP TYPE "public"."llm_provider_old";

ALTER TABLE "users"
  ALTER COLUMN "auth_provider" SET DEFAULT 'openai_auth';

UPDATE "users"
SET "auth_provider" = 'openai_auth'
WHERE "auth_provider" <> 'openai_auth';

ALTER TABLE "user_llm_credentials"
  ADD COLUMN "validation_status" varchar(20) DEFAULT 'invalid' NOT NULL,
  ADD COLUMN "validated_at" timestamp with time zone,
  ADD COLUMN "capabilities" jsonb DEFAULT '{"basic":false,"json":false,"streaming":false,"toolCalling":false,"liteModel":false}'::jsonb NOT NULL,
  ADD COLUMN "last_error_code" integer,
  ADD COLUMN "last_error_message" text;

UPDATE "user_llm_credentials"
SET
  "provider" = 'openai_auth',
  "validation_status" = 'invalid',
  "capabilities" = '{"basic":false,"json":false,"streaming":false,"toolCalling":false,"liteModel":false}'::jsonb
WHERE "provider" IS NOT NULL;
