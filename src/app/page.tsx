import { AuthScreen } from "@/components/auth-screen";
import { FinanceApp } from "@/components/finance-app";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { currentMonth, validMonth, type View } from "@/lib/finance";
import { ensureDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";

const VIEWS: View[] = ["overview", "transactions", "budgets", "reports", "settings"];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string }> }) {
  const params = await searchParams;
  if (params.view === "login" || params.view === "signup") return <AuthScreen key={params.view} mode={params.view} />;

  const session = await getSession();
  // Demo sessions get the day's fresh sample data; visitors without a session see the demo while
  // the browser signs them in.
  const user = session && !session.isDemo ? session : await ensureDemoData();
  const month = validMonth(params.month) ? params.month : currentMonth();
  const data = await getDashboardData(user, month);
  const initialView = VIEWS.includes(params.view as View) ? (params.view as View) : "overview";
  return <FinanceApp initialData={data} initialView={initialView} needsSession={!session} />;
}
