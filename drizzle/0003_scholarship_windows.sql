CREATE TYPE "public"."scholarship_category" AS ENUM('ug_africa', 'ug_outside_africa', 'ug_extra_africa', 'pg_africa', 'pg_outside_africa');--> statement-breakpoint
CREATE TYPE "public"."window_status" AS ENUM('open', 'opens_soon', 'closed', 'not_announced', 'paused');--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "window_status" "window_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "category" "scholarship_category";--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "current_window" text;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "next_window" text;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "key_eligibility" text;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "how_to_apply" text;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "contact_email" varchar(320);--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "research_sources" text;