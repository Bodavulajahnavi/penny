import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * penny creates its own tables on first use, so a brand-new PostgreSQL database works without a
 * manual `drizzle-kit push`. The DDL mirrors src/db/schema.ts — including Drizzle's constraint and
 * index names — so running `drizzle-kit push` later finds nothing to change.
 */
const SCHEMA = [
  sql`CREATE TABLE IF NOT EXISTS "penny_users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(100) NOT NULL,
    "email" varchar(254) NOT NULL,
    "password_hash" text NOT NULL,
    "currency" varchar(3) DEFAULT 'USD' NOT NULL,
    "is_demo" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "penny_users_email_unique" UNIQUE ("email")
  )`,
  sql`CREATE TABLE IF NOT EXISTS "penny_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "token_hash" text NOT NULL,
    "user_id" uuid NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "penny_sessions_token_hash_unique" UNIQUE ("token_hash"),
    CONSTRAINT "penny_sessions_user_id_penny_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "penny_users" ("id") ON DELETE CASCADE
  )`,
  sql`CREATE INDEX IF NOT EXISTS "penny_sessions_user_idx" ON "penny_sessions" USING btree ("user_id")`,
  sql`CREATE TABLE IF NOT EXISTS "penny_transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "type" varchar(10) NOT NULL,
    "description" varchar(120) NOT NULL,
    "amount_cents" integer NOT NULL,
    "category" varchar(30) NOT NULL,
    "date" varchar(10) NOT NULL,
    "account" varchar(30) DEFAULT 'Checking account' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "penny_transactions_user_id_penny_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "penny_users" ("id") ON DELETE CASCADE
  )`,
  sql`CREATE INDEX IF NOT EXISTS "penny_transactions_user_date_idx" ON "penny_transactions" USING btree ("user_id", "date")`,
  sql`CREATE TABLE IF NOT EXISTS "penny_budgets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "category" varchar(30) NOT NULL,
    "month" varchar(7) NOT NULL,
    "amount_cents" integer NOT NULL,
    CONSTRAINT "penny_budgets_user_id_penny_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "penny_users" ("id") ON DELETE CASCADE
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS "penny_budgets_user_category_month_idx" ON "penny_budgets" USING btree ("user_id", "category", "month")`,
];

let ready: Promise<void> | undefined;

/** Ensures every table exists. Runs once per server process; retries if it ever fails. */
export function ensureDatabase(): Promise<void> {
  ready ??= db
    .transaction(async (tx) => {
      // Serialize concurrent first requests so CREATE TABLE IF NOT EXISTS never races.
      await tx.execute(sql`select pg_advisory_xact_lock(73219840)`);
      for (const statement of SCHEMA) await tx.execute(statement);
    })
    .catch((error) => {
      ready = undefined;
      throw error;
    });
  return ready;
}
