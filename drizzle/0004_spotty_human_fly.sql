CREATE TABLE "trivia_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"content" text NOT NULL,
	"time_taken" double precision NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trivia_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'waiting' NOT NULL,
	"current_question_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trivia_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "raffle_winner_identifier" varchar(128);--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "isolated_assets" jsonb;--> statement-breakpoint
ALTER TABLE "invitees" ADD COLUMN "context" text;--> statement-breakpoint
ALTER TABLE "invitees" ADD COLUMN "has_seen_raffle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invitees" ADD COLUMN "is_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trivia_answers" ADD CONSTRAINT "trivia_answers_question_id_trivia_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."trivia_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trivia_answers" ADD CONSTRAINT "trivia_answers_invitee_id_invitees_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."invitees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trivia_games" ADD CONSTRAINT "trivia_games_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trivia_questions" ADD CONSTRAINT "trivia_questions_game_id_trivia_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."trivia_games"("id") ON DELETE no action ON UPDATE no action;