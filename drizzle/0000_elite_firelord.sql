CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"theme" varchar(128) NOT NULL,
	"description" text,
	"event_at" timestamp NOT NULL,
	"location" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raffle_prize" varchar(256),
	"assets" jsonb DEFAULT '{"images":[],"videos":[],"audios":[]}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "invitees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"identifier" varchar(128) NOT NULL,
	"assigned_item" varchar(256),
	"giveaway_number" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitees" ADD CONSTRAINT "invitees_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;