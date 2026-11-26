CREATE TYPE "public"."channel" AS ENUM('whatsapp_txt', 'texto_pegado', 'manual');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('pendiente', 'en_atencion', 'resuelto', 'cerrado', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('reporte', 'respuesta', 'seguimiento', 'confirmacion', 'otro');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('admin', 'tecnico', 'consulta');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('ti', 'asistencia', 'operaciones', 'infraestructura', 'seguridad', 'otros');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"group" "request_type" DEFAULT 'otros' NOT NULL,
	"description" text,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "chat_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar(255),
	"channel" "channel" NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by" uuid
);
--> statement-breakpoint
CREATE TABLE "incident_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"sender_name" varchar(180) NOT NULL,
	"message_text" text NOT NULL,
	"message_date" timestamp with time zone NOT NULL,
	"message_time" varchar(5) NOT NULL,
	"type" "message_type" DEFAULT 'otro' NOT NULL,
	"content_hash" varchar(64),
	"is_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"message_id" uuid,
	"responder_name" varchar(180) NOT NULL,
	"response_text" text NOT NULL,
	"response_date" timestamp with time zone NOT NULL,
	"response_time" varchar(5) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_date" timestamp with time zone NOT NULL,
	"incident_time" varchar(5) NOT NULL,
	"requester_name" varchar(180) NOT NULL,
	"teacher_id" uuid,
	"original_message" text NOT NULL,
	"category_id" uuid,
	"category_label" varchar(120) NOT NULL,
	"request_type" "request_type" DEFAULT 'otros' NOT NULL,
	"status" "incident_status" DEFAULT 'pendiente' NOT NULL,
	"contextualization" text,
	"channel" "channel" NOT NULL,
	"import_id" uuid,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" varchar(180),
	"full_name" varchar(180) NOT NULL,
	"email" varchar(254) NOT NULL,
	"role" "profile_role" DEFAULT 'tecnico' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "teacher_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"alias" varchar(180) NOT NULL,
	"normalized_alias" varchar(180) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_aliases_normalized_alias_unique" UNIQUE("normalized_alias")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"email" varchar(254),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_imports" ADD CONSTRAINT "chat_imports_imported_by_profiles_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_history" ADD CONSTRAINT "incident_history_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_history" ADD CONSTRAINT "incident_history_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_messages" ADD CONSTRAINT "incident_messages_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_responses" ADD CONSTRAINT "incident_responses_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_responses" ADD CONSTRAINT "incident_responses_message_id_incident_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."incident_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_import_id_chat_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."chat_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_aliases" ADD CONSTRAINT "teacher_aliases_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_imports_hash_uq" ON "chat_imports" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "incident_history_incident_idx" ON "incident_history" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_messages_incident_idx" ON "incident_messages" USING btree ("incident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_messages_hash_uq" ON "incident_messages" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "incident_responses_incident_idx" ON "incident_responses" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incidents_date_idx" ON "incidents" USING btree ("incident_date");--> statement-breakpoint
CREATE INDEX "incidents_teacher_idx" ON "incidents" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "incidents_category_idx" ON "incidents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_import_idx" ON "incidents" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "teacher_aliases_teacher_idx" ON "teacher_aliases" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teachers_name_idx" ON "teachers" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "teachers_email_idx" ON "teachers" USING btree ("email");