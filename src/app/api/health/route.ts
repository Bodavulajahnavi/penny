import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureDatabase } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    // Also prepares the tables in a fresh database before the first visitor arrives.
    await ensureDatabase();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
