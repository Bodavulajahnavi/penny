export const EXPENSE_CATEGORIES = ["Food", "Rent", "Transport", "Entertainment", "Shopping", "Other"] as const;
export const CATEGORIES = [...EXPENSE_CATEGORIES, "Salary"] as const;
export type Category = (typeof CATEGORIES)[number];
export type TransactionType = "income" | "expense";
export type View = "overview" | "transactions" | "budgets" | "reports" | "settings";
export const CATEGORY_COLORS: Record<Category, string> = {
  Food: "#347858",
  Rent: "#83ae93",
  Transport: "#b9d0bd",
  Entertainment: "#e0e9dd",
  Shopping: "#b99768",
  Other: "#9caeb9",
  Salary: "#347858",
};
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  currency: string;
  isDemo: number;
  createdAt: string;
}
export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amountCents: number;
  category: Category;
  date: string;
  account: string;
  createdAt?: string;
}
export interface Budget {
  id: string;
  category: Category;
  amountCents: number;
  month: string;
}
export interface MonthSummary {
  month: string;
  incomeCents: number;
  expenseCents: number;
}
export interface DashboardData {
  user: UserProfile;
  month: string;
  transactions: Transaction[];
  budgets: Budget[];
  trends: MonthSummary[];
  summary: {
    balanceCents: number;
    incomeCents: number;
    expenseCents: number;
    previousIncomeCents: number;
    previousExpenseCents: number;
    budgetCents: number;
    incomeCount: number;
  };
}
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
export function today() {
  return new Date().toISOString().slice(0, 10);
}
export function offsetMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
export function monthLabel(month: string, short = false) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function dateLabel(date: string, withYear = false) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
export function money(cents: number, currency = "USD", decimals = true) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(cents / 100);
}
export function compactMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}
export function sumByType(items: Transaction[], type: TransactionType) {
  return items.filter((t) => t.type === type).reduce((sum, t) => sum + t.amountCents, 0);
}
export function categoryTotals(items: Transaction[]) {
  return EXPENSE_CATEGORIES.map((category) => ({
    category,
    amountCents: items
      .filter((t) => t.type === "expense" && t.category === category)
      .reduce((sum, t) => sum + t.amountCents, 0),
    color: CATEGORY_COLORS[category],
  }))
    .filter((c) => c.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);
}
export function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
