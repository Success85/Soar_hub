CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TYPE "public"."ai_decision" AS ENUM('pending', 'approved', 'rejected', 'needs_more_review');--> statement-breakpoint
CREATE TYPE "public"."ai_request_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."answer_category" AS ENUM('personal_experience', 'achievement', 'leadership', 'community_impact', 'challenge_overcome', 'career_goals', 'motivation', 'personal_statement', 'previous_essay', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('draft', 'screening', 'eligible', 'ineligible', 'in_progress', 'submitted', 'shortlisted', 'outcome');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."assessment_trigger" AS ENUM('manual', 'profile_change', 'criteria_change');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('outstanding', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('privacy', 'terms', 'data_processing', 'sms');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('article', 'guide', 'essay_guide', 'cv_guide', 'interview_guide', 'faq', 'video', 'download', 'webinar', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."content_visibility" AS ENUM('public', 'applicants');--> statement-breakpoint
CREATE TYPE "public"."criterion_operator" AS ENUM('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'exists', 'not_exists', 'is_true', 'is_false', 'between', 'age_between', 'matches');--> statement-breakpoint
CREATE TYPE "public"."criterion_severity" AS ENUM('absolute', 'important', 'advisory');--> statement-breakpoint
CREATE TYPE "public"."data_request_status" AS ENUM('pending', 'processing', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."data_request_type" AS ENUM('export', 'deletion');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('academic_transcript', 'certificate', 'cv', 'passport', 'identification', 'essay', 'recommendation_letter', 'financial_documentation', 'other');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('secondary_in_progress', 'secondary_completed', 'undergraduate_in_progress', 'undergraduate_completed', 'postgraduate', 'other');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('student', 'unemployed', 'employed_part_time', 'employed_full_time', 'self_employed', 'other');--> statement-breakpoint
CREATE TYPE "public"."essay_status" AS ENUM('draft', 'submitted_for_review', 'ai_review_pending', 'human_review_pending', 'feedback_approved', 'revision_requested', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."feedback_source" AS ENUM('human', 'ai_approved');--> statement-breakpoint
CREATE TYPE "public"."group_logic" AS ENUM('and', 'or');--> statement-breakpoint
CREATE TYPE "public"."income_band" AS ENUM('very_low', 'low', 'lower_middle', 'middle', 'upper', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('upcoming', 'in_progress', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."application_outcome" AS ENUM('awarded', 'declined', 'waitlisted', 'not_selected', 'pending', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."overall_verdict" AS ENUM('likely_eligible', 'more_info_needed', 'not_eligible');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."programme_level" AS ENUM('undergraduate', 'masters', 'doctoral', 'other');--> statement-breakpoint
CREATE TYPE "public"."referee_status" AS ENUM('sent', 'opened', 'submitted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('uploaded', 'pending_review', 'under_review', 'approved', 'needs_revision', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('applicant', 'reviewer', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('not_scanned', 'pending', 'clean', 'infected', 'error');--> statement-breakpoint
CREATE TYPE "public"."scholarship_status" AS ENUM('draft', 'pending_verification', 'verified', 'published', 'expired', 'archived', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."source_verification" AS ENUM('unverified', 'verified', 'outdated');--> statement-breakpoint
CREATE TYPE "public"."uploaded_via" AS ENUM('applicant', 'referee', 'admin', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deletion_requested', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('eligible', 'ineligible', 'undetermined');--> statement-breakpoint
CREATE TABLE "ai_critique_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"decision" "ai_decision" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"edited_output" jsonb,
	"changes_made" jsonb,
	"notes" text,
	"decided_at" timestamp with time zone,
	"published_feedback_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_critique_approvals_result_id_unique" UNIQUE("result_id")
);
--> statement-breakpoint
CREATE TABLE "ai_critique_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"essay_version_id" uuid NOT NULL,
	"requested_by" uuid,
	"rubric_id" uuid,
	"rubric_version" integer,
	"status" "ai_request_status" DEFAULT 'queued' NOT NULL,
	"provider" varchar(40),
	"model" varchar(100),
	"prompt_version" varchar(20) NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_critique_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"output" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_critique_results_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"metric" varchar(80) NOT NULL,
	"dimension" varchar(120) DEFAULT '' NOT NULL,
	"value" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_day_metric_dimension_pk" PRIMARY KEY("day","metric","dimension")
);
--> statement-breakpoint
CREATE TABLE "answer_bank_embeddings" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(100) NOT NULL,
	"dimensions" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" vector NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_bank_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "answer_category" NOT NULL,
	"title" varchar(250) NOT NULL,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"template_key" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"due_date" date NOT NULL,
	"duration_days" integer NOT NULL,
	"planned_duration_days" integer NOT NULL,
	"status" "milestone_status" DEFAULT 'upcoming' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"is_compressed" boolean DEFAULT false NOT NULL,
	"is_custom_date" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"completion_notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"assessment_id" uuid,
	"status" "application_status" DEFAULT 'draft' NOT NULL,
	"outcome" "application_outcome",
	"outcome_at" timestamp with time zone,
	"outcome_notes" text,
	"deadline" timestamp with time zone,
	"progress" integer DEFAULT 0 NOT NULL,
	"schedule_compressed" boolean DEFAULT false NOT NULL,
	"schedule_warning" text,
	"schedule_generated_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"submission_reference" varchar(200),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(30),
	"target_type" varchar(60),
	"target_id" varchar(80),
	"ip" varchar(64),
	"user_agent" text,
	"metadata" jsonb,
	"previous_state" jsonb,
	"new_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "consent_type" NOT NULL,
	"version" varchar(20) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(320) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "data_request_type" NOT NULL,
	"status" "data_request_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"processed_by" uuid,
	"notes" text,
	"export_storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_comment_anchors" (
	"comment_id" uuid PRIMARY KEY NOT NULL,
	"document_version_id" uuid NOT NULL,
	"selected_text" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"context_before" text,
	"context_after" text
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_version_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'outstanding' NOT NULL,
	"assigned_to" uuid,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_version_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "review_status" NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"uploaded_by" uuid,
	"uploaded_via" "uploaded_via" DEFAULT 'applicant' NOT NULL,
	"scan_status" "scan_status" DEFAULT 'not_scanned' NOT NULL,
	"review_status" "review_status" DEFAULT 'uploaded' NOT NULL,
	"extracted_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"requirement_id" uuid,
	"category" "document_category" NOT NULL,
	"title" varchar(200) NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"review_status" "review_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "educational_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(250) NOT NULL,
	"slug" varchar(250) NOT NULL,
	"category_id" uuid,
	"type" "content_type" DEFAULT 'article' NOT NULL,
	"description" varchar(500),
	"body" text DEFAULT '' NOT NULL,
	"featured_image_url" text,
	"external_url" text,
	"author_name" varchar(150),
	"author_id" uuid,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"visibility" "content_visibility" DEFAULT 'public' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" varchar(250),
	"seo_description" varchar(320),
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"status" "assessment_status" DEFAULT 'in_progress' NOT NULL,
	"overall_verdict" "overall_verdict",
	"trigger" "assessment_trigger" DEFAULT 'manual' NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"profile_snapshot" jsonb,
	"eligible_count" integer DEFAULT 0 NOT NULL,
	"ineligible_count" integer DEFAULT 0 NOT NULL,
	"undetermined_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eligibility_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"criterion_id" uuid,
	"criterion_name" varchar(150) NOT NULL,
	"criterion_description" text,
	"field_key" varchar(100) NOT NULL,
	"applicant_value" jsonb,
	"required_value" jsonb,
	"verdict" "verdict" NOT NULL,
	"explanation" text NOT NULL,
	"is_fixable" boolean NOT NULL,
	"is_absolute" boolean NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"recommended_action" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"essay_version_id" uuid NOT NULL,
	"author_id" uuid,
	"source" "feedback_source" DEFAULT 'human' NOT NULL,
	"body" text,
	"critique" jsonb,
	"selected_text" text,
	"start_offset" integer,
	"end_offset" integer,
	"status" "comment_status" DEFAULT 'outstanding' NOT NULL,
	"resolved_at" timestamp with time zone,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"essay_version_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"decision" varchar(30),
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "essay_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"values" text,
	"dimensions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" varchar(250) NOT NULL,
	"prompt" text NOT NULL,
	"body" text NOT NULL,
	"word_count" integer NOT NULL,
	"note" varchar(250),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"scholarship_id" uuid,
	"title" varchar(250) NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"word_limit" integer,
	"current_version" integer DEFAULT 0 NOT NULL,
	"status" "essay_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"result" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "milestone_dependencies" (
	"milestone_id" uuid NOT NULL,
	"depends_on_id" uuid NOT NULL,
	CONSTRAINT "milestone_dependencies_milestone_id_depends_on_id_pk" PRIMARY KEY("milestone_id","depends_on_id")
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"provider" varchar(40),
	"response" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"milestone_reminders" boolean DEFAULT true NOT NULL,
	"overdue_reminders" boolean DEFAULT true NOT NULL,
	"referee_updates" boolean DEFAULT true NOT NULL,
	"feedback_updates" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" varchar(250),
	"body" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"recipient_email" varchar(320),
	"recipient_phone" varchar(30),
	"subject" varchar(250),
	"body" text NOT NULL,
	"action_url" text,
	"data" jsonb,
	"idempotency_key" varchar(250) NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"provider" varchar(40),
	"provider_message_id" varchar(250),
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"date_of_birth" date,
	"gender" varchar(30),
	"state_of_origin" varchar(60),
	"country_of_citizenship" varchar(60),
	"country_of_residence" varchar(60),
	"phone" varchar(30),
	"education_level" "education_level",
	"current_school" varchar(200),
	"graduation_year" integer,
	"qualifications" text[],
	"credit_passes" integer,
	"grade_average" numeric(5, 2),
	"academic_results_summary" text,
	"first_generation" boolean,
	"household_income_band" "income_band",
	"demonstrates_financial_need" boolean,
	"has_disability" boolean,
	"is_refugee_or_displaced" boolean,
	"employment_status" "employment_status",
	"preferred_programme" varchar(200),
	"career_interests" text,
	"personal_background" text,
	"onboarding_completed_at" timestamp with time zone,
	"welcome_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_embeddings" (
	"content_hash" varchar(64) PRIMARY KEY NOT NULL,
	"model" varchar(100) NOT NULL,
	"embedding" vector NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "referee_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"referee_name" varchar(200) NOT NULL,
	"referee_email" varchar(320) NOT NULL,
	"relationship" varchar(120) NOT NULL,
	"organization" varchar(200),
	"message" text,
	"deadline" date NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"token_used_at" timestamp with time zone,
	"status" "referee_status" DEFAULT 'sent' NOT NULL,
	"opened_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"reminder_sent_at" timestamp with time zone,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referee_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"confirmed_name" varchar(200) NOT NULL,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referee_uploads_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "resource_tags" (
	"resource_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "resource_tags_resource_id_tag_id_pk" PRIMARY KEY("resource_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "reviewer_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"assigned_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" "role" NOT NULL,
	"permission" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_permission_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
CREATE TABLE "saved_scholarships" (
	"user_id" uuid NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_scholarships_user_id_scholarship_id_pk" PRIMARY KEY("user_id","scholarship_id")
);
--> statement-breakpoint
CREATE TABLE "scholarship_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"group_id" uuid,
	"name" varchar(150) NOT NULL,
	"description" text,
	"field_key" varchar(100) NOT NULL,
	"operator" "criterion_operator" NOT NULL,
	"required_value" jsonb,
	"severity" "criterion_severity" DEFAULT 'important' NOT NULL,
	"is_fixable" boolean DEFAULT true NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"pass_explanation" text,
	"fail_explanation" text,
	"recommended_action" text,
	"source_reference" text,
	"question_text" text,
	"answer_type" varchar(20),
	"answer_options" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_criteria_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"logic" "group_logic" DEFAULT 'and' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"category" "document_category" NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"name" varchar(250) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_milestone_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid,
	"key" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"duration_days" integer NOT NULL,
	"depends_on" text[] DEFAULT '{}'::text[] NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" uuid,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"source_name" varchar(250) NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"verification_status" "source_verification" DEFAULT 'unverified' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(250) NOT NULL,
	"slug" varchar(250) NOT NULL,
	"partner_university" varchar(250) NOT NULL,
	"country" varchar(80) NOT NULL,
	"city" varchar(120),
	"programme_level" "programme_level" DEFAULT 'undergraduate' NOT NULL,
	"scholarship_type" varchar(120) DEFAULT 'Fully funded' NOT NULL,
	"programmes" text[] DEFAULT '{}'::text[] NOT NULL,
	"summary" varchar(500),
	"description" text DEFAULT '' NOT NULL,
	"tuition_coverage" text,
	"living_allowance" text,
	"accommodation_benefits" text,
	"travel_benefits" text,
	"other_benefits" text,
	"opening_date" timestamp with time zone,
	"deadline" timestamp with time zone,
	"timezone" varchar(60) DEFAULT 'Africa/Lagos' NOT NULL,
	"application_url" text,
	"status" "scholarship_status" DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"verified_by" uuid,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" varchar(64),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"entity_type" varchar(60),
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_critique_approvals" ADD CONSTRAINT "ai_critique_approvals_result_id_ai_critique_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."ai_critique_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_approvals" ADD CONSTRAINT "ai_critique_approvals_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_approvals" ADD CONSTRAINT "ai_critique_approvals_published_feedback_id_essay_feedback_id_fk" FOREIGN KEY ("published_feedback_id") REFERENCES "public"."essay_feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_requests" ADD CONSTRAINT "ai_critique_requests_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_requests" ADD CONSTRAINT "ai_critique_requests_essay_version_id_essay_versions_id_fk" FOREIGN KEY ("essay_version_id") REFERENCES "public"."essay_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_requests" ADD CONSTRAINT "ai_critique_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_requests" ADD CONSTRAINT "ai_critique_requests_rubric_id_essay_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."essay_rubrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_critique_results" ADD CONSTRAINT "ai_critique_results_request_id_ai_critique_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ai_critique_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_bank_embeddings" ADD CONSTRAINT "answer_bank_embeddings_entry_id_answer_bank_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."answer_bank_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_bank_embeddings" ADD CONSTRAINT "answer_bank_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_bank_entries" ADD CONSTRAINT "answer_bank_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_milestones" ADD CONSTRAINT "application_milestones_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_milestones" ADD CONSTRAINT "application_milestones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_milestones" ADD CONSTRAINT "application_milestones_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_state_transitions" ADD CONSTRAINT "application_state_transitions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_state_transitions" ADD CONSTRAINT "application_state_transitions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_assessment_id_eligibility_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."eligibility_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment_anchors" ADD CONSTRAINT "document_comment_anchors_comment_id_document_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."document_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment_anchors" ADD CONSTRAINT "document_comment_anchors_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_application_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."application_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_requirement_id_scholarship_document_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."scholarship_document_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD CONSTRAINT "educational_resources_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD CONSTRAINT "educational_resources_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_assessment_answers" ADD CONSTRAINT "eligibility_assessment_answers_assessment_id_eligibility_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."eligibility_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_assessment_answers" ADD CONSTRAINT "eligibility_assessment_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_assessment_answers" ADD CONSTRAINT "eligibility_assessment_answers_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_assessments" ADD CONSTRAINT "eligibility_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_assessments" ADD CONSTRAINT "eligibility_assessments_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_assessment_id_eligibility_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."eligibility_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_criterion_id_scholarship_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."scholarship_criteria"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_feedback" ADD CONSTRAINT "essay_feedback_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_feedback" ADD CONSTRAINT "essay_feedback_essay_version_id_essay_versions_id_fk" FOREIGN KEY ("essay_version_id") REFERENCES "public"."essay_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_feedback" ADD CONSTRAINT "essay_feedback_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_reviews" ADD CONSTRAINT "essay_reviews_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_reviews" ADD CONSTRAINT "essay_reviews_essay_version_id_essay_versions_id_fk" FOREIGN KEY ("essay_version_id") REFERENCES "public"."essay_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_reviews" ADD CONSTRAINT "essay_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_rubrics" ADD CONSTRAINT "essay_rubrics_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_rubrics" ADD CONSTRAINT "essay_rubrics_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_versions" ADD CONSTRAINT "essay_versions_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_versions" ADD CONSTRAINT "essay_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_milestone_id_application_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."application_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_depends_on_id_application_milestones_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "public"."application_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_requests" ADD CONSTRAINT "referee_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_requests" ADD CONSTRAINT "referee_requests_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_requests" ADD CONSTRAINT "referee_requests_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_requests" ADD CONSTRAINT "referee_requests_document_id_application_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."application_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_uploads" ADD CONSTRAINT "referee_uploads_request_id_referee_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."referee_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_uploads" ADD CONSTRAINT "referee_uploads_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_educational_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."educational_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tag_id_content_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."content_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_scholarships" ADD CONSTRAINT "saved_scholarships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_scholarships" ADD CONSTRAINT "saved_scholarships_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_criteria" ADD CONSTRAINT "scholarship_criteria_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_criteria" ADD CONSTRAINT "scholarship_criteria_group_id_scholarship_criteria_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."scholarship_criteria_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_criteria_groups" ADD CONSTRAINT "scholarship_criteria_groups_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_document_requirements" ADD CONSTRAINT "scholarship_document_requirements_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_files" ADD CONSTRAINT "scholarship_files_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_files" ADD CONSTRAINT "scholarship_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_milestone_templates" ADD CONSTRAINT "scholarship_milestone_templates_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_revisions" ADD CONSTRAINT "scholarship_revisions_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_revisions" ADD CONSTRAINT "scholarship_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_sources" ADD CONSTRAINT "scholarship_sources_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_sources" ADD CONSTRAINT "scholarship_sources_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_approvals_decision_idx" ON "ai_critique_approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "ai_requests_status_idx" ON "ai_critique_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_requests_essay_idx" ON "ai_critique_requests" USING btree ("essay_id");--> statement-breakpoint
CREATE INDEX "answer_bank_user_idx" ON "answer_bank_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "answer_bank_fts_idx" ON "answer_bank_entries" USING gin (to_tsvector('english', "title" || ' ' || "body"));--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_app_key_uq" ON "application_milestones" USING btree ("application_id","template_key");--> statement-breakpoint
CREATE INDEX "milestones_due_idx" ON "application_milestones" USING btree ("due_date","status");--> statement-breakpoint
CREATE INDEX "app_transitions_app_idx" ON "application_state_transitions" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_sch_uq" ON "applications" USING btree ("user_id","scholarship_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_sch_idx" ON "applications" USING btree ("scholarship_id");--> statement-breakpoint
CREATE INDEX "audit_event_idx" ON "audit_logs" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_uq" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "content_categories_slug_uq" ON "content_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "content_tags_slug_uq" ON "content_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "data_requests_status_idx" ON "data_requests" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "doc_comments_version_idx" ON "document_comments" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX "doc_reviews_version_idx" ON "document_reviews" USING btree ("document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_versions_num_uq" ON "document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "application_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_app_idx" ON "application_documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "documents_review_idx" ON "application_documents" USING btree ("review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_slug_uq" ON "educational_resources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "resources_status_idx" ON "educational_resources" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "assessment_answers_user_idx" ON "eligibility_assessment_answers" USING btree ("user_id","scholarship_id","field_key");--> statement-breakpoint
CREATE INDEX "assessments_user_sch_idx" ON "eligibility_assessments" USING btree ("user_id","scholarship_id","created_at");--> statement-breakpoint
CREATE INDEX "eligibility_results_assessment_idx" ON "eligibility_results" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "essay_feedback_essay_idx" ON "essay_feedback" USING btree ("essay_id");--> statement-breakpoint
CREATE INDEX "essay_reviews_essay_idx" ON "essay_reviews" USING btree ("essay_id");--> statement-breakpoint
CREATE INDEX "essay_reviews_status_idx" ON "essay_reviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "essay_versions_num_uq" ON "essay_versions" USING btree ("essay_id","version_number");--> statement-breakpoint
CREATE INDEX "essays_user_idx" ON "essays" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "essays_status_idx" ON "essays" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","created_at");--> statement-breakpoint
CREATE INDEX "delivery_attempts_notif_idx" ON "notification_delivery_attempts" USING btree ("notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_key_channel_uq" ON "notification_templates" USING btree ("key","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idem_uq" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_dispatch_idx" ON "notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "notifications_provider_msg_idx" ON "notifications" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referee_token_uq" ON "referee_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "referee_app_idx" ON "referee_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "referee_status_idx" ON "referee_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reviewer_assignment_active_uq" ON "reviewer_assignments" USING btree ("application_id","reviewer_id") WHERE is_active;--> statement-breakpoint
CREATE INDEX "reviewer_assignment_reviewer_idx" ON "reviewer_assignments" USING btree ("reviewer_id","is_active");--> statement-breakpoint
CREATE INDEX "criteria_sch_idx" ON "scholarship_criteria" USING btree ("scholarship_id","sort_order");--> statement-breakpoint
CREATE INDEX "criteria_groups_sch_idx" ON "scholarship_criteria_groups" USING btree ("scholarship_id");--> statement-breakpoint
CREATE INDEX "doc_req_sch_idx" ON "scholarship_document_requirements" USING btree ("scholarship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_tpl_key_uq" ON "scholarship_milestone_templates" USING btree ("scholarship_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_tpl_global_key_uq" ON "scholarship_milestone_templates" USING btree ("key") WHERE scholarship_id IS NULL;--> statement-breakpoint
CREATE INDEX "scholarship_revisions_sch_idx" ON "scholarship_revisions" USING btree ("scholarship_id","created_at");--> statement-breakpoint
CREATE INDEX "scholarship_sources_sch_idx" ON "scholarship_sources" USING btree ("scholarship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarships_slug_uq" ON "scholarships" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scholarships_status_idx" ON "scholarships" USING btree ("status","is_active");--> statement-breakpoint
CREATE INDEX "scholarships_deadline_idx" ON "scholarships" USING btree ("deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_activity_event_idx" ON "user_activity" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "user_activity_entity_idx" ON "user_activity" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_created_idx" ON "users" USING btree ("created_at");