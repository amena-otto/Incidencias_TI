CREATE TABLE "classifier_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_key" varchar(120) NOT NULL,
	"category" varchar(120) NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text NOT NULL,
	"synonyms" text[] DEFAULT '{}' NOT NULL,
	"expressions" text[] DEFAULT '{}' NOT NULL,
	"variants" text[] DEFAULT '{}' NOT NULL,
	"abbreviations" text[] DEFAULT '{}' NOT NULL,
	"related" text[] DEFAULT '{}' NOT NULL,
	"negatives" text[] DEFAULT '{}' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" varchar(40) NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "classifier_concepts_concept_key_unique" UNIQUE("concept_key")
);
--> statement-breakpoint
CREATE TABLE "classifier_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar(96),
	"original_text" text NOT NULL,
	"original_hash" varchar(64) NOT NULL,
	"suggested_category" varchar(120) NOT NULL,
	"corrected_category" varchar(120) NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"concepts" jsonb,
	"rule_applied" text,
	"reviewer_id" uuid,
	"reviewer_name" varchar(180) DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"classifier_version" varchar(40) NOT NULL,
	"dictionary_version" varchar(40) NOT NULL,
	"import_id" uuid
);
--> statement-breakpoint
CREATE TABLE "classifier_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(40) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"notes" text,
	"active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classifier_rule_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "classifier_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(60) NOT NULL,
	"concept_key" varchar(120),
	"title" varchar(180) NOT NULL,
	"payload" jsonb NOT NULL,
	"evidence_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "classifier_concepts" ADD CONSTRAINT "classifier_concepts_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifier_feedback" ADD CONSTRAINT "classifier_feedback_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifier_feedback" ADD CONSTRAINT "classifier_feedback_import_id_chat_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."chat_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifier_rule_versions" ADD CONSTRAINT "classifier_rule_versions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifier_suggestions" ADD CONSTRAINT "classifier_suggestions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifier_suggestions" ADD CONSTRAINT "classifier_suggestions_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classifier_concepts_category_idx" ON "classifier_concepts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "classifier_concepts_active_idx" ON "classifier_concepts" USING btree ("active");--> statement-breakpoint
CREATE INDEX "classifier_feedback_reviewed_idx" ON "classifier_feedback" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "classifier_feedback_reviewer_idx" ON "classifier_feedback" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "classifier_suggestions_status_idx" ON "classifier_suggestions" USING btree ("status");