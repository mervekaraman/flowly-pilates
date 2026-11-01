CREATE TYPE "public"."fixed_slot_status" AS ENUM('pending', 'active', 'rejected', 'ended');--> statement-breakpoint
CREATE TABLE "fixed_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" text NOT NULL,
	"status" "fixed_slot_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_slots_weekday_range" CHECK ("fixed_slots"."weekday" between 1 and 6),
	CONSTRAINT "fixed_slots_start_time_format" CHECK ("fixed_slots"."start_time" ~ '^[0-2][0-9]:00$')
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "fixed_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "fixed_slots" ADD CONSTRAINT "fixed_slots_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_slots_member_time_open" ON "fixed_slots" USING btree ("member_id","weekday","start_time") WHERE "fixed_slots"."status" in ('pending', 'active');--> statement-breakpoint
CREATE INDEX "fixed_slots_status_idx" ON "fixed_slots" USING btree ("status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fixed_slot_id_fixed_slots_id_fk" FOREIGN KEY ("fixed_slot_id") REFERENCES "public"."fixed_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Like every other table (see 0007): hidden from the Supabase Data API; the app connects as owner.
ALTER TABLE "fixed_slots" ENABLE ROW LEVEL SECURITY;
