import { pgTable, uuid, varchar, text, timestamp, jsonb, doublePrecision, integer, boolean } from "drizzle-orm/pg-core";

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 256 }).notNull(),
  theme: varchar("theme", { length: 128 }).notNull(),
  description: text("description"),
  eventAt: timestamp("event_at", { withTimezone: false }).notNull(),
  location: text("location").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  items: jsonb("items").$type<string[]>().default([]).notNull(),
  rafflePrize: varchar("raffle_prize", { length: 256 }),
  raffleWinnerIdentifier: varchar("raffle_winner_identifier", { length: 128 }),
  assets: jsonb("assets").$type<{ images: Array<{ name: string; source: string; mimeType: string }>; videos: Array<{ name: string; source: string; mimeType: string }>; audios: Array<{ name: string; source: string; mimeType: string }> }>().default({ images: [], videos: [], audios: [] }).notNull(),
  // Cache for isolated images to avoid repeated expensive AI processing
  isolatedAssets: jsonb("isolated_assets").$type<Array<{ originalUrl: string; isolatedUrl: string; backgroundColor: string }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;

export const invitees = pgTable("invitees", {
  id: uuid("id").defaultRandom().primaryKey(),
  invitationId: uuid("invitation_id").notNull().references(() => invitations.id),
  identifier: varchar("identifier", { length: 128 }).notNull(),
  name: varchar("name", { length: 128 }),
  age: integer("age"),
  imageUrl: varchar("image_url", { length: 512 }),
  isOrganizer: boolean("is_organizer").default(false).notNull(),
  assignedItem: varchar("assigned_item", { length: 256 }),
  context: text("context"),
  hasSeen: boolean("has_seen").default(false).notNull(),
  hasSeenRaffle: boolean("has_seen_raffle").default(false).notNull(),
  giveawayNumber: varchar("giveaway_number", { length: 32 }),
  isConfirmed: boolean("is_confirmed").default(false).notNull(),
  experience: jsonb("experience").$type<any>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invitee = typeof invitees.$inferSelect;

export const triviaGames = pgTable("trivia_games", {
  id: uuid("id").defaultRandom().primaryKey(),
  invitationId: uuid("invitation_id").notNull().references(() => invitations.id),
  status: varchar("status", { length: 32 }).default("waiting").notNull(), // waiting, active, finished
  currentQuestionId: uuid("current_question_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const triviaQuestions = pgTable("trivia_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").notNull().references(() => triviaGames.id),
  content: text("content").notNull(),
  status: varchar("status", { length: 32 }).default("open").notNull(), // open, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const triviaAnswers = pgTable("trivia_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id").notNull().references(() => triviaQuestions.id),
  inviteeId: uuid("invitee_id").notNull().references(() => invitees.id),
  content: text("content").notNull(),
  timeTaken: doublePrecision("time_taken").notNull(), // seconds from render
  isWinner: boolean("is_winner").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});