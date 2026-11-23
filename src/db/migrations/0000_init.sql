CREATE TYPE "public"."event_status" AS ENUM('open', 'running', 'finished');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('A', 'B', 'draw');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('draft', 'published', 'running', 'paused', 'overtime', 'closed');--> statement-breakpoint
CREATE TYPE "public"."table_kind" AS ENUM('2v2', '1v1', 'bye');--> statement-breakpoint
CREATE TYPE "public"."team" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" uuid,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"roster_id" text,
	"device_token_hash" text,
	"joined_round" integer DEFAULT 1 NOT NULL,
	"dropped_after_round" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_players_device_token_hash_unique" UNIQUE("device_token_hash"),
	CONSTRAINT "event_players_event_roster_unique" UNIQUE("event_id","roster_id"),
	CONSTRAINT "event_players_joined_round_positive" CHECK ("event_players"."joined_round" >= 1),
	CONSTRAINT "event_players_dropped_after_round_valid" CHECK ("event_players"."dropped_after_round" is null or "event_players"."dropped_after_round" >= 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"status" "event_status" DEFAULT 'open' NOT NULL,
	"rounds" integer DEFAULT 3 NOT NULL,
	"round_duration_sec" integer DEFAULT 3000 NOT NULL,
	"seed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_code_unique" UNIQUE("code"),
	CONSTRAINT "events_code_format" CHECK ("events"."code" ~ '^[A-Z0-9]{4}$'),
	CONSTRAINT "events_rounds_positive" CHECK ("events"."rounds" >= 1),
	CONSTRAINT "events_round_duration_positive" CHECK ("events"."round_duration_sec" > 0)
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "round_status" DEFAULT 'draft' NOT NULL,
	"seed" integer NOT NULL,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"elapsed_before_pause_sec" integer DEFAULT 0 NOT NULL,
	"duration_sec" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_event_number_unique" UNIQUE("event_id","number"),
	CONSTRAINT "rounds_number_positive" CHECK ("rounds"."number" >= 1),
	CONSTRAINT "rounds_duration_positive" CHECK ("rounds"."duration_sec" > 0),
	CONSTRAINT "rounds_elapsed_non_negative" CHECK ("rounds"."elapsed_before_pause_sec" >= 0)
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"table_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"event_player_id" uuid NOT NULL,
	"team" "team" NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "seats_table_id_team_position_pk" PRIMARY KEY("table_id","team","position"),
	CONSTRAINT "seats_round_player_unique" UNIQUE("round_id","event_player_id"),
	CONSTRAINT "seats_position_valid" CHECK ("seats"."position" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" "table_kind" NOT NULL,
	"outcome" "outcome",
	"games_a" smallint,
	"games_b" smallint,
	"reported_by" uuid,
	"reported_at" timestamp with time zone,
	"overridden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tables_round_number_unique" UNIQUE("round_id","number"),
	CONSTRAINT "tables_id_round_unique" UNIQUE("id","round_id"),
	CONSTRAINT "tables_number_positive" CHECK ("tables"."number" >= 1),
	CONSTRAINT "tables_games_valid" CHECK (("tables"."games_a" is null or "tables"."games_a" >= 0) and ("tables"."games_b" is null or "tables"."games_b" >= 0)),
	CONSTRAINT "tables_games_only_1v1" CHECK ("tables"."kind" = '1v1' or ("tables"."games_a" is null and "tables"."games_b" is null))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_players" ADD CONSTRAINT "event_players_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_event_player_id_event_players_id_fk" FOREIGN KEY ("event_player_id") REFERENCES "public"."event_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_table_round_fk" FOREIGN KEY ("table_id","round_id") REFERENCES "public"."tables"("id","round_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_reported_by_event_players_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."event_players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_event_at_idx" ON "audit_log" USING btree ("event_id","at");--> statement-breakpoint
CREATE INDEX "seats_event_player_idx" ON "seats" USING btree ("event_player_id");