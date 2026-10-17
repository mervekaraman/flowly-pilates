ALTER TABLE "users" ADD COLUMN "password_set" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub_unique" ON "users" USING btree ("google_sub");