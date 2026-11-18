"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChartPie,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sprout,
  Sun,
  Target,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { BudgetOverview, BudgetsPage, ReportsPage, SummaryCards } from "@/components/dashboard-sections";
import { BudgetForm, ProfileSettings, TransactionForm, type TransactionInput } from "@/components/forms";
import { Logo, PlantIllustration } from "@/components/icons";
import { Modal } from "@/components/modal";
import { TransactionTable } from "@/components/transaction-table";
import { apiJson, hasFallbackSession, rememberSession, setFallbackSession } from "@/lib/api-client";
import {
  EXPENSE_CATEGORIES,
  currentMonth,
  money,
  monthLabel,
  offsetMonth,
  type Budget,
  type Category,
  type DashboardData,
  type Transaction,
  type UserProfile,
  type View,
} from "@/lib/finance";

const CashFlowChart = dynamic(() => import("@/components/charts").then((charts) => charts.CashFlowChart), {
  ssr: false,
  loading: () => <ChartLoading />,
});
const SpendingChart = dynamic(() => import("@/components/charts").then((charts) => charts.SpendingChart), {
  ssr: false,
  loading: () => <ChartLoading />,
});

function ChartLoading() {
  return (
    <div className="card chart-loading" aria-busy="true" aria-label="Loading chart">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton skeleton-chart" />
    </div>
  );
}

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "budgets", label: "Budgets", icon: ChartPie },
  { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const HEADINGS: Record<View, { title: string; subtitle: string }> = {
  overview: { title: "Welcome back", subtitle: "Let’s make every penny count." },
  transactions: { title: "Your transactions", subtitle: "The little details behind your bigger picture." },
  budgets: {
    title: "A little plan. A lot of possibility.",
    subtitle: "Give every penny a purpose with monthly budgets.",
  },
  reports: { title: "Your money, in perspective.", subtitle: "Find the patterns. Celebrate the progress." },
  settings: { title: "Your space, your way.", subtitle: "The little details that make penny yours." },
};

const HELP_STEPS = [
  {
    icon: ReceiptText,
    title: "Start with the little details",
    text: "Add your income and expenses. Your balance updates instantly.",
  },
  { icon: Target, title: "Give every category a plan", text: "Set monthly limits and keep an eye on your progress." },
  {
    icon: ChartNoAxesCombined,
    title: "See the bigger picture",
    text: "Explore your spending breakdown and six-month cash-flow trends.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    text: "Changes are saved to your account. Export your transactions anytime.",
  },
];

type Toast = { message: string; type: "success" | "error" };
type DeleteTarget = { kind: "transaction"; item: Transaction } | { kind: "budget"; item: Budget };

const categoryRank = (category: string) => (EXPENSE_CATEGORIES as readonly string[]).indexOf(category);
const totalBudget = (budgets: Budget[]) => budgets.reduce((sum, budget) => sum + budget.amountCents, 0);

/** Applies a saved (or removed) transaction locally so balances, totals, and trends update instantly. */
function applyTransaction(data: DashboardData, next: Transaction | null, original?: Transaction): DashboardData {
  const summary = { ...data.summary };
  const adjust = (transaction: Transaction, sign: 1 | -1) => {
    const signed = transaction.type === "income" ? transaction.amountCents : -transaction.amountCents;
    if (transaction.date.slice(0, 7) <= data.month) summary.balanceCents += sign * signed;
    if (!transaction.date.startsWith(data.month)) return;
    if (transaction.type === "income") {
      summary.incomeCents += sign * transaction.amountCents;
      summary.incomeCount += sign;
    } else {
      summary.expenseCents += sign * transaction.amountCents;
    }
  };
  if (original) adjust(original, -1);
  if (next) adjust(next, 1);

  const transactions = data.transactions.filter((t) => t.id !== original?.id && t.id !== next?.id);
  if (next && next.date.startsWith(data.month)) transactions.unshift(next);
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const changes: [Transaction | null | undefined, 1 | -1][] = [
    [original, -1],
    [next, 1],
  ];
  const trends = data.trends.map((trend) => {
    let { incomeCents, expenseCents } = trend;
    for (const [transaction, sign] of changes) {
      if (!transaction || !transaction.date.startsWith(trend.month)) continue;
      if (transaction.type === "income") incomeCents += sign * transaction.amountCents;
      else expenseCents += sign * transaction.amountCents;
    }
    return { ...trend, incomeCents, expenseCents };
  });
  return { ...data, transactions, summary, trends };
}

export function FinanceApp({
  initialData,
  initialView = "overview",
  needsSession = false,
}: {
  initialData: DashboardData;
  initialView?: View;
  needsSession?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [transactionModal, setTransactionModal] = useState<{
    initial?: Transaction;
    type?: "income" | "expense";
  } | null>(null);
  const [budgetModal, setBudgetModal] = useState<{ category?: Category; budget?: Budget } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [search, setSearch] = useState("");
  // While a visitor's session is being established, show the loading bar and keep writes disabled.
  const [loading, setLoading] = useState(needsSession);
  const [ready, setReady] = useState(!needsSession);
  const [mutationPending, setMutationPending] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const sessionStarted = useRef(false);

  const notify = useCallback((message: string, type: Toast["type"] = "success") => setToast({ message, type }), []);

  const refresh = useCallback(
    async (month?: string) => {
      setData(await apiJson<DashboardData>(`/api/dashboard?month=${month ?? data.month}`));
    },
    [data.month],
  );

  // First visit without a session: resume this tab's session if there is one, otherwise open the demo.
  useEffect(() => {
    if (!needsSession || sessionStarted.current) return;
    sessionStarted.current = true;
    const establishSession = async () => {
      try {
        if (hasFallbackSession()) {
          const current = await apiJson<{ user: UserProfile | null }>("/api/auth");
          if (current.user) {
            await refresh();
            setReady(true);
            return;
          }
          setFallbackSession(null);
        }
        const demo = await apiJson<{ sessionToken?: string }>("/api/auth", {
          method: "POST",
          body: JSON.stringify({ action: "demo" }),
        });
        await rememberSession(demo.sessionToken);
        await refresh();
        setReady(true);
      } catch (error) {
        notify(error instanceof Error ? error.message : "We couldn’t open your workspace. Please try again.", "error");
      } finally {
        setLoading(false);
      }
    };
    void establishSession();
  }, [needsSession, refresh, notify]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).get("view");
      setView(NAV.some((item) => item.id === next) ? (next as View) : "overview");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setMonthOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function navigate(next: View) {
    setView(next);
    setSidebarOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
    window.history.pushState({}, "", next === "overview" ? "/" : `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changeMonth(month: string) {
    setMonthOpen(false);
    if (month === data.month || !/^\d{4}-\d{2}$/.test(month)) return;
    setLoading(true);
    try {
      await refresh(month);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load this month.", "error");
    } finally {
      setLoading(false);
    }
  }

  /** Re-syncs from the server after a successful write; the write itself is never rolled back here. */
  async function resync(month?: string) {
    try {
      await refresh(month);
    } catch {
      notify("Saved — but we couldn’t refresh your dashboard. Reload to see the latest totals.", "error");
    }
  }

  async function saveTransaction(input: TransactionInput, id?: string) {
    if (!ready) throw new Error("Please sign in to save your changes.");
    const previous = data;
    const original = id ? previous.transactions.find((t) => t.id === id) : undefined;
    setMutationPending(true);
    setData(applyTransaction(previous, { ...input, id: id ?? `pending-${Date.now()}` }, original));
    let saved: Transaction;
    try {
      saved = await apiJson<Transaction>(id ? `/api/transactions/${id}` : "/api/transactions", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
    } catch (error) {
      setData(previous);
      setMutationPending(false);
      throw error;
    }
    setData(applyTransaction(previous, saved, original));
    setTransactionModal(null);
    notify(id ? "Transaction updated. All looking good." : "Transaction added. Every penny accounted for.");
    // Opens the transaction's month if its date moved outside the one on screen.
    await resync(saved.date.slice(0, 7));
    setMutationPending(false);
  }

  async function saveBudget(category: Category, amountCents: number) {
    if (!ready) throw new Error("Please sign in to save your changes.");
    const previous = data;
    const others = previous.budgets.filter((b) => b.category !== category);
    const budgets = (
      amountCents > 0
        ? [...others, { id: `pending-${category}`, category, amountCents, month: previous.month }]
        : others
    ).sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
    setMutationPending(true);
    setData({ ...previous, budgets, summary: { ...previous.summary, budgetCents: totalBudget(budgets) } });
    try {
      await apiJson("/api/budgets", {
        method: "PUT",
        body: JSON.stringify({ category, amountCents, month: previous.month }),
      });
    } catch (error) {
      setData(previous);
      setMutationPending(false);
      throw error;
    }
    setBudgetModal(null);
    notify(amountCents > 0 ? "Budget saved. A little plan goes a long way." : "Budget limit removed.");
    await resync();
    setMutationPending(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await apiJson(
        target.kind === "transaction" ? `/api/transactions/${target.item.id}` : `/api/budgets?id=${target.item.id}`,
        { method: "DELETE" },
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete. Please try again.", "error");
      setDeleting(false);
      return;
    }
    setData((current) => {
      if (target.kind === "transaction") return applyTransaction(current, null, target.item);
      const budgets = current.budgets.filter((b) => b.id !== target.item.id);
      return { ...current, budgets, summary: { ...current.summary, budgetCents: totalBudget(budgets) } };
    });
    setDeleteTarget(null);
    setDeleting(false);
    notify(target.kind === "transaction" ? "Transaction deleted." : "Budget limit removed.");
    void resync();
  }

  async function logout() {
    try {
      await apiJson("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to sign out. Please try again.", "error");
      return;
    }
    setFallbackSession(null);
    router.replace("/?view=login");
    router.refresh();
  }

  async function saveProfile(input: Record<string, string>) {
    const result = await apiJson<{ user: UserProfile }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    setData((current) => ({ ...current, user: result.user }));
    notify("Your account details have been updated.");
  }

  function exportTransactions(items: Transaction[] = data.transactions) {
    if (!items.length) {
      notify("There are no transactions to export yet.", "error");
      return;
    }
    // Text that spreadsheets would evaluate as a formula gets a leading apostrophe; amounts stay numeric.
    const safeText = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
    const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ["Date", "Description", "Type", "Category", "Amount", "Currency", "Account"],
      ...items.map((t) => [
        t.date,
        safeText(t.description),
        t.type,
        t.category,
        ((t.type === "expense" ? -t.amountCents : t.amountCents) / 100).toFixed(2),
        data.user.currency,
        safeText(t.account),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `penny-transactions-${data.month}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Your statement is ready. Downloaded as CSV.");
  }

  const alerts = data.budgets
    .map((budget) => ({
      ...budget,
      spent: data.transactions
        .filter((t) => t.type === "expense" && t.category === budget.category)
        .reduce((sum, t) => sum + t.amountCents, 0),
    }))
    .filter((budget) => budget.amountCents > 0 && budget.spent / budget.amountCents >= 0.85);
  const initials = data.user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const currentNav = NAV.find((item) => item.id === view) ?? NAV[0];
  const canWrite = ready && !loading;
  const editBudget = (category: Category) =>
    setBudgetModal({ category, budget: data.budgets.find((b) => b.category === category) });

  return (
    <div className="app-shell">
      {loading && <div className="loading-line" role="progressbar" aria-label="Loading your workspace" />}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <button onClick={() => navigate("overview")} aria-label="Penny overview">
            <Logo />
          </button>
          <button
            className="icon-button mobile-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "nav-active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === "transactions" && <span className="nav-count">{data.transactions.length}</span>}
              {view === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-encouragement">
            <PlantIllustration />
            <h3>
              Small steps.
              <br />
              Big possibilities.
            </h3>
            <p>A little today goes a long way.</p>
            <button onClick={() => navigate("reports")}>
              Explore your insights
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="sidebar-help" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} strokeWidth={1.7} />
            <span>Help & getting started</span>
            <ArrowUpRight size={14} />
          </button>
          <button className="sidebar-profile" onClick={() => navigate("settings")}>
            <span className="avatar">{initials}</span>
            <span>
              <strong>{data.user.name}</strong>
              <small>{data.user.isDemo ? "Demo account" : "Personal account"}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">
              <LayoutDashboard size={16} strokeWidth={1.7} />
            </span>
            <span className="breadcrumb-slash">/</span>
            <span className="breadcrumb-current">{currentNav.label}</span>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={16} strokeWidth={1.8} />
              <input
                ref={searchRef}
                aria-label="Search transactions"
                placeholder="Search transactions..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (view !== "transactions") navigate("transactions");
                }}
              />
              <kbd>/</kbd>
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notificationsOpen ? "selected" : ""}`}
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={19} strokeWidth={1.7} />
                {alerts.length > 0 && <i />}
              </button>
              {notificationsOpen && (
                <>
                  <div className="popover-dismiss" onClick={() => setNotificationsOpen(false)} />
                  <div className="popover notifications-popover">
                    <h3>
                      A little heads-up <span>{alerts.length}</span>
                    </h3>
                    {alerts.length ? (
                      alerts.map((budget) => (
                        <button
                          key={budget.id}
                          className="notification-item"
                          onClick={() => {
                            setBudgetModal({ budget, category: budget.category });
                            setNotificationsOpen(false);
                          }}
                        >
                          <span className="notification-icon">
                            <Target size={18} />
                          </span>
                          <span>
                            <strong>{budget.category} budget check-in</strong>
                            <small>
                              You’ve used {Math.round((budget.spent / budget.amountCents) * 100)}% of your{" "}
                              {money(budget.amountCents, data.user.currency, false)} limit.
                            </small>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      ))
                    ) : (
                      <div className="notifications-empty">
                        <Check size={24} />
                        <strong>All looking good.</strong>
                        <p>No budget alerts right now.</p>
                      </div>
                    )}
                    <button className="notification-footer" onClick={() => navigate("budgets")}>
                      Review your budgets
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="top-profile-wrap">
              <button
                className="top-profile"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                aria-label="Open account menu"
                aria-expanded={profileOpen}
              >
                <span className="avatar">{initials}</span>
                <ChevronDown size={13} />
              </button>
              {profileOpen && (
                <>
                  <div className="popover-dismiss" onClick={() => setProfileOpen(false)} />
                  <div className="popover profile-popover">
                    <div className="profile-popover-heading">
                      <strong>{data.user.name}</strong>
                      <small>{data.user.email}</small>
                    </div>
                    <button onClick={() => navigate("settings")}>
                      <Settings size={16} />
                      Account settings
                    </button>
                    <button onClick={logout}>
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="welcome-title">
                <h1>{view === "overview" ? `Welcome back, ${data.user.name.split(" ")[0]}` : HEADINGS[view].title}</h1>
                {view === "overview" && <Sun className="welcome-sun" size={25} strokeWidth={1.6} />}
              </div>
              <p>{HEADINGS[view].subtitle}</p>
            </div>
            <div className="page-actions">
              {view !== "settings" && (
                <div className="month-picker">
                  <button
                    className="month-arrow"
                    onClick={() => changeMonth(offsetMonth(data.month, -1))}
                    disabled={!canWrite}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    className="month-current"
                    onClick={() => setMonthOpen(!monthOpen)}
                    aria-expanded={monthOpen}
                    disabled={!canWrite}
                  >
                    <CalendarDays size={15} strokeWidth={1.7} />
                    <span>{monthLabel(data.month)}</span>
                    <ChevronDown size={13} />
                  </button>
                  <button
                    className="month-arrow"
                    onClick={() => changeMonth(offsetMonth(data.month, 1))}
                    disabled={!canWrite}
                    aria-label="Next month"
                  >
                    <ChevronRight size={15} />
                  </button>
                  {monthOpen && (
                    <>
                      <div className="popover-dismiss" onClick={() => setMonthOpen(false)} />
                      <div className="popover month-popover">
                        <span className="popover-label">JUMP TO A MONTH</span>
                        {Array.from({ length: 6 }, (_, index) => offsetMonth(currentMonth(), -index)).map((month) => (
                          <button
                            key={month}
                            onClick={() => changeMonth(month)}
                            className={month === data.month ? "selected" : ""}
                          >
                            {monthLabel(month)}
                            {month === data.month && <Check size={14} />}
                          </button>
                        ))}
                        <label>
                          Choose another month
                          <input
                            type="month"
                            value={data.month}
                            min="2000-01"
                            max="2099-12"
                            onChange={(event) => changeMonth(event.target.value)}
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
              {view === "overview" || view === "transactions" ? (
                <button
                  className="button button-primary add-main-button"
                  onClick={() => setTransactionModal({})}
                  disabled={!canWrite || mutationPending}
                >
                  <Plus size={17} />
                  Add transaction
                </button>
              ) : view === "budgets" ? (
                <button className="button button-primary" onClick={() => setBudgetModal({})} disabled={!canWrite}>
                  <Plus size={17} />
                  Add budget
                </button>
              ) : view === "reports" ? (
                <button className="button button-secondary" onClick={() => exportTransactions()}>
                  <Download size={16} />
                  Export report
                </button>
              ) : null}
            </div>
          </div>

          {view === "overview" && (
            <>
              <SummaryCards data={data} />
              <div className="dashboard-grid chart-row">
                <CashFlowChart
                  transactions={data.transactions}
                  trends={data.trends}
                  month={data.month}
                  currency={data.user.currency}
                />
                <SpendingChart
                  transactions={data.transactions}
                  currency={data.user.currency}
                  onReport={() => navigate("reports")}
                />
              </div>
              <div className="dashboard-grid details-row">
                <TransactionTable
                  transactions={data.transactions}
                  currency={data.user.currency}
                  compact
                  search={search}
                  onSearch={setSearch}
                  onAdd={() => setTransactionModal({})}
                  onEdit={(transaction) => setTransactionModal({ initial: transaction })}
                  onDelete={(transaction) => setDeleteTarget({ kind: "transaction", item: transaction })}
                  onViewAll={() => navigate("transactions")}
                  onExport={exportTransactions}
                />
                <BudgetOverview data={data} onEdit={editBudget} onManage={() => navigate("budgets")} />
              </div>
            </>
          )}

          {view === "transactions" && (
            <>
              <div className="transaction-summary-strip">
                <span>
                  <span className="tiny-dot green-dot" />
                  Money in
                  <strong className="positive-amount">{money(data.summary.incomeCents, data.user.currency)}</strong>
                </span>
                <span>
                  <span className="tiny-dot peach-dot" />
                  Money out<strong>{money(data.summary.expenseCents, data.user.currency)}</strong>
                </span>
                <span>
                  <Wallet size={16} />
                  Net cash flow
                  <strong
                    className={
                      data.summary.incomeCents >= data.summary.expenseCents ? "positive-amount" : "negative-value"
                    }
                  >
                    {money(data.summary.incomeCents - data.summary.expenseCents, data.user.currency)}
                  </strong>
                </span>
              </div>
              <TransactionTable
                key={data.month}
                transactions={data.transactions}
                currency={data.user.currency}
                search={search}
                onSearch={setSearch}
                onAdd={() => setTransactionModal({})}
                onEdit={(transaction) => setTransactionModal({ initial: transaction })}
                onDelete={(transaction) => setDeleteTarget({ kind: "transaction", item: transaction })}
                onExport={exportTransactions}
              />
            </>
          )}

          {view === "budgets" && (
            <BudgetsPage
              data={data}
              onEdit={editBudget}
              onAdd={() => setBudgetModal({})}
              onDelete={(id) => {
                const budget = data.budgets.find((b) => b.id === id);
                if (budget) setDeleteTarget({ kind: "budget", item: budget });
              }}
            />
          )}

          {view === "reports" && (
            <>
              <SummaryCards data={data} />
              <ReportsPage data={data} />
              <div className="dashboard-grid chart-row">
                <CashFlowChart
                  transactions={data.transactions}
                  trends={data.trends}
                  month={data.month}
                  currency={data.user.currency}
                />
                <SpendingChart transactions={data.transactions} currency={data.user.currency} />
              </div>
            </>
          )}

          {view === "settings" && (
            <ProfileSettings
              key={data.user.id}
              user={data.user}
              onSave={saveProfile}
              onLogout={logout}
              onExport={() => exportTransactions()}
            />
          )}

          <footer className="workspace-footer">
            <span>
              <Sprout size={14} strokeWidth={1.6} />A little more clarity. A little less worry.
            </span>
            <span>
              All amounts in {data.user.currency}
              <span className="footer-dot">·</span>
              <span className="saved-dot" />
              {mutationPending ? "Saving changes…" : "All changes saved"}
            </span>
          </footer>
        </main>
      </div>

      {transactionModal && (
        <Modal
          title={transactionModal.initial ? "Edit transaction" : "A penny for your thoughts."}
          subtitle={
            transactionModal.initial
              ? "Keep the little details up to date."
              : "Add an income or expense. We’ll handle the bigger picture."
          }
          onClose={() => {
            if (!mutationPending) setTransactionModal(null);
          }}
        >
          <TransactionForm
            initial={transactionModal.initial}
            defaultType={transactionModal.type}
            month={data.month}
            currency={data.user.currency}
            onSubmit={saveTransaction}
            onCancel={() => setTransactionModal(null)}
          />
        </Modal>
      )}

      {budgetModal && (
        <Modal
          title={budgetModal.budget ? "A little room to adjust." : "Give your money a plan."}
          subtitle={`Set a monthly limit for ${monthLabel(data.month)}.`}
          onClose={() => {
            if (!mutationPending) setBudgetModal(null);
          }}
        >
          <BudgetForm
            initial={budgetModal.budget}
            defaultCategory={budgetModal.category}
            categories={[...EXPENSE_CATEGORIES]}
            month={data.month}
            currency={data.user.currency}
            onSubmit={(category, amountCents) => saveBudget(category, amountCents)}
            onCancel={() => setBudgetModal(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={deleteTarget.kind === "transaction" ? "Delete this transaction?" : "Remove this budget?"}
          subtitle="A quick check before we make a change."
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        >
          <div className="delete-confirmation">
            <span className="delete-confirmation-icon">
              <Trash2 size={24} />
            </span>
            <strong>
              {deleteTarget.kind === "transaction"
                ? deleteTarget.item.description
                : `${deleteTarget.item.category} budget`}
            </strong>
            <p>
              {deleteTarget.kind === "transaction"
                ? `${money(deleteTarget.item.amountCents, data.user.currency)} · ${deleteTarget.item.date}`
                : "Your transactions will stay exactly as they are. Only this monthly limit will be removed."}
            </p>
            <p className="delete-warning">This action can’t be undone.</p>
          </div>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Keep it
            </button>
            <button className="button button-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </Modal>
      )}

      {helpOpen && (
        <Modal
          title="A little help to get started."
          subtitle="Better money habits, one small step at a time."
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-steps">
            {HELP_STEPS.map((step, index) => (
              <div key={step.title}>
                <span className="help-step-icon">
                  <step.icon size={21} />
                </span>
                <div>
                  <small>0{index + 1}</small>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button className="button button-primary" onClick={() => setHelpOpen(false)}>
              Got it. Let’s go.
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
          {toast.type === "success" ? (
            <span className="toast-icon">
              <Check size={15} />
            </span>
          ) : (
            <AlertCircle size={19} />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
