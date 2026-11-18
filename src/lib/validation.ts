import { ApiError } from "@/lib/auth";
import { CATEGORIES, validDate, type Category, type TransactionType } from "@/lib/finance";

const ACCOUNTS = ["Checking account", "Credit card", "Cash"];

export function parseTransaction(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Please provide the transaction details.");
  }
  const { type, description, amountCents, category, date, account } = body as Record<string, unknown>;
  if (type !== "income" && type !== "expense") throw new ApiError(400, "Choose income or expense.");
  if (
    typeof amountCents !== "number" ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 100_000_000
  ) {
    throw new ApiError(400, "Enter an amount between 0.01 and 1,000,000.");
  }
  if (typeof description !== "string" || !description.trim() || description.trim().length > 120) {
    throw new ApiError(400, "Enter a description of up to 120 characters.");
  }
  const validCategory =
    CATEGORIES.includes(category as Category) && (type === "income" ? category === "Salary" : category !== "Salary");
  if (!validCategory) throw new ApiError(400, "Choose a valid category.");
  if (!validDate(date)) throw new ApiError(400, "Choose a valid transaction date.");
  if (account !== undefined && !ACCOUNTS.includes(String(account))) throw new ApiError(400, "Choose a valid account.");
  return {
    type: type as TransactionType,
    description: description.trim(),
    amountCents,
    category: category as Category,
    date,
    account: typeof account === "string" ? account : "Checking account",
  };
}
