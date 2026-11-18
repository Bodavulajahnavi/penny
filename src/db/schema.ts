import { pgTable, uuid, varchar, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("penny_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "penny_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("penny_sessions_user_idx").on(table.userId)],
);

export const transactions = pgTable(
  "penny_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 10 }).notNull(),
    description: varchar("description", { length: 120 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    account: varchar("account", { length: 30 }).notNull().default("Checking account"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("penny_transactions_user_date_idx").on(table.userId, table.date)],
);

export const budgets = pgTable(
  "penny_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 30 }).notNull(),
    month: varchar("month", { length: 7 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => [uniqueIndex("penny_budgets_user_category_month_idx").on(table.userId, table.category, table.month)],
);
