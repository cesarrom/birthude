ALTER TABLE "invitees" ADD COLUMN "name" varchar(128);--> statement-breakpoint
ALTER TABLE "invitees" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "invitees" ADD COLUMN "image_url" varchar(512);--> statement-breakpoint
ALTER TABLE "invitees" ADD COLUMN "is_organizer" boolean DEFAULT false NOT NULL;