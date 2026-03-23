CREATE TYPE "public"."llm_provider" AS ENUM('openrouter', 'codex');--> statement-breakpoint
CREATE TABLE "user_llm_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "llm_provider" NOT NULL,
	"encrypted_tokens" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_llm_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" varchar(50) DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_llm_credentials" ADD CONSTRAINT "user_llm_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;