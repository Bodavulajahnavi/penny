import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError, assertSameOrigin, handleApiError, requireUser } from "@/lib/auth";
import { toTransaction } from "@/lib/data";
import { parseTransaction } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function transactionId(context: Context) {
  const { id } = await context.params;
  if (!UUID.test(id)) throw new ApiError(404, "Transaction not found.");
  return id;
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const id = await transactionId(context);
    const input = parseTransaction(await request.json());
    const [row] = await db
      .update(transactions)
      .set(input)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();
    if (!row) throw new ApiError(404, "Transaction not found.");
    return Response.json(toTransaction(row));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const id = await transactionId(context);
    const [row] = await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning({ id: transactions.id });
    if (!row) throw new ApiError(404, "Transaction not found.");
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
