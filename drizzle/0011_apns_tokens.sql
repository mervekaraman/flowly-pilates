CREATE TABLE "apns_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text,
	"token" text NOT NULL,
	"sandbox" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apns_tokens" ADD CONSTRAINT "apns_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apns_tokens" ADD CONSTRAINT "apns_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apns_tokens_token_idx" ON "apns_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "apns_tokens_user_idx" ON "apns_tokens" USING btree ("user_id");--> statement-breakpoint
-- Like every other table (see 0007): hidden from the Supabase Data API; the app connects as owner.
ALTER TABLE "apns_tokens" ENABLE ROW LEVEL SECURITY;
