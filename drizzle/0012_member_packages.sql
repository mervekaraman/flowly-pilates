CREATE TABLE "member_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"lesson_count" smallint NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_packages_lesson_count_range" CHECK ("member_packages"."lesson_count" between 1 and 200),
	CONSTRAINT "member_packages_dates_order" CHECK ("member_packages"."ends_on" >= "member_packages"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "package_id" uuid;--> statement-breakpoint
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_packages_member_idx" ON "member_packages" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_member_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."member_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Like every other table (see 0007): hidden from the Supabase Data API; the app connects as owner.
ALTER TABLE "member_packages" ENABLE ROW LEVEL SECURITY;
