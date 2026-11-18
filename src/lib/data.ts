import { db } from "@/db";
import { budgets, transactions } from "@/db/schema";
import type { users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { publicUser } from "@/lib/auth";
import {
  EXPENSE_CATEGORIES,
  currentMonth,
  offsetMonth,
  sumByType,
  type Budget,
  type Category,
  type DashboardData,
  type Transaction,
} from "@/lib/finance";

type UserRow = typeof users.$inferSelect;

export function toTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction["type"],
    description: row.description,
    amountCents: row.amountCents,
    category: row.category as Category,
    date: row.date,
    account: row.account,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBudget(row: typeof budgets.$inferSelect): Budget {
  return { id: row.id, category: row.category as Category, amountCents: row.amountCents, month: row.month };
}

const categoryRank = (category: string) => (EXPENSE_CATEGORIES as readonly string[]).indexOf(category);

export async function getDashboardData(user: UserRow, month = currentMonth()): Promise<DashboardData> {
  const [transactionRows, budgetRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.date), desc(transactions.createdAt)),
    db.select().from(budgets).where(eq(budgets.userId, user.id)),
  ]);
  const items = transactionRows.map(toTransaction);
  const monthItems = items.filter((t) => t.date.startsWith(month));
  const previousItems = items.filter((t) => t.date.startsWith(offsetMonth(month, -1)));
  // A stable category order keeps budget cards from jumping around after edits.
  const monthBudgets = budgetRows
    .filter((b) => b.month === month)
    .map(toBudget)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
  const trends = Array.from({ length: 6 }, (_, index) => {
    const trendMonth = offsetMonth(month, index - 5);
    const list = items.filter((t) => t.date.startsWith(trendMonth));
    return { month: trendMonth, incomeCents: sumByType(list, "income"), expenseCents: sumByType(list, "expense") };
  });

  return {
    user: publicUser(user),
    month,
    transactions: monthItems,
    budgets: monthBudgets,
    trends,
    summary: {
      balanceCents: items
        .filter((t) => t.date.slice(0, 7) <= month)
        .reduce((sum, t) => sum + (t.type === "income" ? t.amountCents : -t.amountCents), 0),
      incomeCents: sumByType(monthItems, "income"),
      expenseCents: sumByType(monthItems, "expense"),
      previousIncomeCents: sumByType(previousItems, "income"),
      previousExpenseCents: sumByType(previousItems, "expense"),
      budgetCents: monthBudgets.reduce((sum, b) => sum + b.amountCents, 0),
      incomeCount: monthItems.filter((t) => t.type === "income").length,
    },
  };
}
