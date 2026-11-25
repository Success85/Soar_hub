CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" varchar(30) DEFAULT 'standard' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"source" varchar(30) NOT NULL,
	"payment_id" uuid,
	"granted_by" uuid,
	"note" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tx_ref" varchar(80) NOT NULL,
	"provider" varchar(30) DEFAULT 'flutterwave' NOT NULL,
	"purpose" varchar(30) DEFAULT 'membership' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"provider_transaction_id" varchar(80),
	"payment_method" varchar(40),
	"membership_months" integer DEFAULT 12 NOT NULL,
	"provider_response" jsonb,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_payment_uq" ON "memberships" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tx_ref_uq" ON "payments" USING btree ("tx_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_tx_uq" ON "payments" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id","created_at");