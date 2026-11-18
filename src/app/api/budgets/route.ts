import { db } from "@/db";
import { budgets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError, assertSameOrigin, handleApiError, requireUser } from "@/lib/auth";
import { toBudget } from "@/lib/data";
import { EXPENSE_CATEGORIES, validMonth } from "@/lib/finance";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creates or updates a monthly category limit. A limit of 0 removes the budget. */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { category, month, amountCents } = ((await request.json()) ?? {}) as Record<string, unknown>;
    if (typeof category !== "string" || !EXPENSE_CATEGORIES.some((c) => c === category)) {
      throw new ApiError(400, "Choose a valid expense category.");
    }
    if (!validMonth(month)) throw new ApiError(400, "Choose a valid month.");
    if (
      typeof amountCents !== "number" ||
      !Number.isSafeInteger(amountCents) ||
      amountCents < 0 ||
      amountCents > 100_000_000
    ) {
      throw new ApiError(400, "Enter a budget between 0 and 1,000,000.");
    }

    if (amountCents === 0) {
      await db
        .delete(budgets)
        .where(and(eq(budgets.userId, user.id), eq(budgets.category, category), eq(budgets.month, month)));
      return Response.json({ removed: true, category, month });
    }

    const [row] = await db
      .insert(budgets)
      .values({ userId: user.id, category, month, amountCents })
      .onConflictDoUpdate({ target: [budgets.userId, budgets.category, budgets.month], set: { amountCents } })
      .returning();
    return Response.json(toBudget(row));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!UUID.test(id)) throw new ApiError(404, "Budget not found.");
    const [deleted] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
      .returning({ id: budgets.id });
    if (!deleted) throw new ApiError(404, "Budget not found.");
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
