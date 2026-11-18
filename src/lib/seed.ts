import { db } from "@/db";
import { budgets, transactions, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ensureDatabase } from "@/lib/bootstrap";
import { currentMonth, offsetMonth, today, type Category } from "@/lib/finance";

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo1234";

const HISTORY: [Category, number, string][] = [
  ["Rent", 95000, "Monthly rent"],
  ["Food", 110000, "Groceries & dining"],
  ["Transport", 40000, "Getting around"],
  ["Entertainment", 70000, "Entertainment & subscriptions"],
];
const THIS_MONTH: [string, number, Category, number, string][] = [
  ["Grocery run", 6450, "Food", 0, "Checking account"],
  ["Spotify Premium", 1099, "Entertainment", 1, "Credit card"],
  ["Dinner with friends", 4800, "Food", 2, "Checking account"],
  ["Metro top-up", 5000, "Transport", 3, "Checking account"],
  ["Weekly groceries", 8235, "Food", 4, "Checking account"],
  ["Cinema night", 3200, "Entertainment", 5, "Credit card"],
  ["Coffee & a little treat", 1250, "Food", 6, "Cash"],
  ["Uber ride", 2800, "Transport", 7, "Credit card"],
  ["Lunch on campus", 4275, "Food", 8, "Checking account"],
  ["Fresh groceries", 6785, "Food", 9, "Checking account"],
  ["Bus pass", 2500, "Transport", 10, "Checking account"],
  ["Weekly groceries", 12500, "Food", 11, "Checking account"],
  ["Live music", 7701, "Entertainment", 12, "Credit card"],
  ["Coffee with friends", 1850, "Food", 13, "Cash"],
  ["Train ticket", 2500, "Transport", 14, "Checking account"],
  ["Dinner out", 2500, "Food", 15, "Credit card"],
];
const LIMITS: [Category, number][] = [
  ["Food", 55000],
  ["Rent", 100000],
  ["Transport", 20000],
  ["Entertainment", 25000],
  ["Shopping", 20000],
];

const utcDate = (value: Date) => value.toISOString().slice(0, 10);

async function findDemoUser() {
  const [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  return user;
}

/**
 * Returns the shared demo account. Its sample data is rebuilt once per day (UTC), relative to today,
 * so the workspace always shows a lively current month and visitors' experiments are tidied up.
 * The account ID never changes, so existing demo sessions stay valid.
 */
export async function ensureDemoData() {
  await ensureDatabase();
  const demo = await findDemoUser();
  if (demo && utcDate(demo.createdAt) === today()) return demo;
  await refreshDemoAccount();
  const fresh = await findDemoUser();
  if (!fresh) throw new Error("The demo account could not be prepared.");
  return fresh;
}

function sampleTransactions(userId: string): (typeof transactions.$inferInsert)[] {
  const month = currentMonth();
  const day = new Date().getUTCDate();
  const monthDay = (value: number) => `${month}-${String(value).padStart(2, "0")}`;
  // Spread this month's transactions across the days elapsed so far, so they never clump on day 1.
  const dateAt = (daysAgo: number) => monthDay(day - (day > 15 ? daysAgo : Math.round((daysAgo * (day - 1)) / 15)));
  const rows: (typeof transactions.$inferInsert)[] = [];

  // Five complete months of history for the six-month trend.
  for (let index = 0; index < 5; index++) {
    const historyMonth = offsetMonth(month, index - 5);
    rows.push({
      userId,
      type: "income",
      description: "Monthly salary",
      amountCents: 420000,
      category: "Salary",
      date: `${historyMonth}-01`,
    });
    HISTORY.forEach(([category, amountCents, description], position) =>
      rows.push({
        userId,
        type: "expense",
        description,
        amountCents: category === "Entertainment" ? amountCents + index * 2500 : amountCents,
        category,
        date: `${historyMonth}-${String(3 + position * 5).padStart(2, "0")}`,
      }),
    );
  }

  // This month, day by day — never dated in the future.
  rows.push({
    userId,
    type: "income",
    description: "Monthly salary",
    amountCents: 420000,
    category: "Salary",
    date: monthDay(1),
  });
  rows.push({
    userId,
    type: "income",
    description: "Freelance project",
    amountCents: 65000,
    category: "Salary",
    date: dateAt(3),
  });
  rows.push({
    userId,
    type: "expense",
    description: "Monthly rent",
    amountCents: 95000,
    category: "Rent",
    date: monthDay(Math.min(2, day)),
  });
  for (const [description, amountCents, category, daysAgo, account] of THIS_MONTH) {
    rows.push({ userId, type: "expense", description, amountCents, category, date: dateAt(daysAgo), account });
  }
  return rows;
}

function sampleBudgets(userId: string): (typeof budgets.$inferInsert)[] {
  const month = currentMonth();
  return Array.from({ length: 6 }, (_, index) => offsetMonth(month, -index)).flatMap((budgetMonth) =>
    LIMITS.map(([category, amountCents]) => ({ userId, category, month: budgetMonth, amountCents })),
  );
}

async function refreshDemoAccount() {
  await db.transaction(async (tx) => {
    // Serialize concurrent visits so the demo is (re)built exactly once.
    await tx.execute(sql`select pg_advisory_xact_lock(73219841)`);
    const [existing] = await tx.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
    if (existing && utcDate(existing.createdAt) === today()) return;

    const now = new Date();
    let userId: string;
    if (existing) {
      userId = existing.id;
      await tx.delete(transactions).where(eq(transactions.userId, userId));
      await tx.delete(budgets).where(eq(budgets.userId, userId));
      await tx
        .update(users)
        .set({
          name: "Alex Morgan",
          currency: "USD",
          isDemo: 1,
          createdAt: now, // doubles as "sample data generated at"
          ...(verifyPassword(DEMO_PASSWORD, existing.passwordHash)
            ? {}
            : { passwordHash: hashPassword(DEMO_PASSWORD) }),
        })
        .where(eq(users.id, userId));
    } else {
      userId = randomUUID();
      await tx.insert(users).values({
        id: userId,
        name: "Alex Morgan",
        email: DEMO_EMAIL,
        passwordHash: hashPassword(DEMO_PASSWORD),
        isDemo: 1,
        createdAt: now,
      });
    }
    await tx.insert(transactions).values(sampleTransactions(userId));
    await tx.insert(budgets).values(sampleBudgets(userId));
  });
}
