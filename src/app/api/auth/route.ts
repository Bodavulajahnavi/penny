import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ApiError,
  assertSameOrigin,
  createSession,
  destroySession,
  getSession,
  handleApiError,
  hashPassword,
  isUniqueViolation,
  publicUser,
  verifyPassword,
} from "@/lib/auth";
import { ensureDatabase } from "@/lib/bootstrap";
import { ensureDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_ACCOUNT = "An account with this email already exists. Please sign in.";
// Checked when an email isn't registered, so response times don't reveal which accounts exist.
const PLACEHOLDER_HASH = hashPassword("penny-placeholder-password");

export async function GET() {
  try {
    const user = await getSession();
    return Response.json(
      { user: user ? publicUser(user) : null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    if (!body || typeof body !== "object") throw new ApiError(400, "Please provide valid JSON.");

    if (body.action === "logout") {
      await destroySession();
      return Response.json({ ok: true });
    }

    await ensureDatabase();
    if (body.action === "demo") {
      const user = await ensureDemoData();
      const sessionToken = await createSession(user.id);
      return Response.json({ user: publicUser(user), sessionToken });
    }
    if (body.action !== "login" && body.action !== "signup") throw new ApiError(400, "Unknown authentication action.");

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new ApiError(400, "Enter a valid email address.");
    if (!password || Buffer.byteLength(password, "utf8") > 128) {
      throw new ApiError(400, "Enter a password of up to 128 characters.");
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let user: typeof users.$inferSelect;
    if (body.action === "signup") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 100) throw new ApiError(400, "Enter your name (2–100 characters).");
      if (password.length < 8) throw new ApiError(400, "Use at least 8 characters for your password.");
      if (existing) throw new ApiError(409, DUPLICATE_ACCOUNT);
      try {
        [user] = await db
          .insert(users)
          .values({ name, email, passwordHash: hashPassword(password) })
          .returning();
      } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, DUPLICATE_ACCOUNT);
        throw error;
      }
    } else {
      const valid = verifyPassword(password, existing?.passwordHash ?? PLACEHOLDER_HASH);
      if (!existing || !valid) throw new ApiError(401, "The email or password is incorrect.");
      user = existing;
    }

    const sessionToken = await createSession(user.id);
    return Response.json({ user: publicUser(user), sessionToken }, { status: body.action === "signup" ? 201 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
