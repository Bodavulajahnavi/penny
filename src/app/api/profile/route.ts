import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import {
  ApiError,
  assertSameOrigin,
  handleApiError,
  hashPassword,
  publicUser,
  requireUser,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const CURRENCIES = ["USD", "EUR", "GBP", "INR"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = await request.json();
    if (!body || typeof body !== "object") throw new ApiError(400, "Please provide your account details.");

    const name = typeof body.name === "string" ? body.name.trim() : user.name;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : user.email;
    const currency = typeof body.currency === "string" ? body.currency : user.currency;
    if (name.length < 2 || name.length > 100) throw new ApiError(400, "Enter a name between 2 and 100 characters.");
    if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new ApiError(400, "Enter a valid email address.");
    if (!CURRENCIES.includes(currency)) throw new ApiError(400, "Choose a supported currency.");
    // The demo login is shared by every visitor, so its credentials stay fixed.
    if (user.isDemo && (email !== user.email || body.newPassword)) {
      throw new ApiError(
        400,
        "The shared demo account’s email and password can’t be changed. Create your own account to try this.",
      );
    }

    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)))
      .limit(1);
    if (duplicate) throw new ApiError(409, "This email is already in use.");

    let passwordHash = user.passwordHash;
    if (body.newPassword) {
      if (
        typeof body.newPassword !== "string" ||
        body.newPassword.length < 8 ||
        Buffer.byteLength(body.newPassword, "utf8") > 128
      ) {
        throw new ApiError(400, "Use a new password of 8–128 characters.");
      }
      if (typeof body.currentPassword !== "string" || !verifyPassword(body.currentPassword, user.passwordHash)) {
        throw new ApiError(400, "Your current password is incorrect.");
      }
      passwordHash = hashPassword(body.newPassword);
    }

    const [updated] = await db
      .update(users)
      .set({ name, email, currency, passwordHash })
      .where(eq(users.id, user.id))
      .returning();
    return Response.json({ user: publicUser(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}
