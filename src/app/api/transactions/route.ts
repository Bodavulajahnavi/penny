import { db } from "@/db";
import { transactions } from "@/db/schema";
import { assertSameOrigin, handleApiError, requireUser } from "@/lib/auth";
import { toTransaction } from "@/lib/data";
import { parseTransaction } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = parseTransaction(await request.json());
    const [row] = await db
      .insert(transactions)
      .values({ ...input, userId: user.id })
      .returning();
    return Response.json(toTransaction(row), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
