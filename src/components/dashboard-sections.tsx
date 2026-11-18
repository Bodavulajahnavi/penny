"use client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ChartPie,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  Sprout,
  TrendingUp,
  Target,
  CalendarDays,
} from "lucide-react";
import {
  money,
  categoryTotals,
  EXPENSE_CATEGORIES,
  monthLabel,
  type DashboardData,
  type Transaction,
  type Category,
} from "@/lib/finance";
import { CategoryIcon } from "@/components/icons";
export function SummaryCards({ data }: { data: DashboardData }) {
  const { summary: s, user } = data;
  const currency = user.currency;
  const remaining = s.budgetCents - s.expenseCents;
  const used = s.budgetCents ? (s.expenseCents / s.budgetCents) * 100 : 0;
  const expenseChange = s.previousExpenseCents
    ? ((s.expenseCents - s.previousExpenseCents) / s.previousExpenseCents) * 100
    : 0;
  const net = s.incomeCents - s.expenseCents;
  return (
    <div className="summary-grid">
      <section className="stat-card balance-stat">
        <div className="stat-top">
          <span>Total balance</span>
          <span className="stat-icon">
            <Wallet size={19} strokeWidth={1.7} />
          </span>
        </div>
        <strong className="stat-value">{money(s.balanceCents, currency)}</strong>
        <div className="stat-bottom">
          <span className="balance-gain">
            <ArrowUpRight size={13} />
            {net >= 0 ? "+" : ""}
            {money(net, currency)}
          </span>
          <span>this month</span>
        </div>
        <div className="balance-decoration" />
      </section>
      <section className="stat-card">
        <div className="stat-top">
          <span>Total income</span>
          <span className="stat-icon green-icon">
            <ArrowDownLeft size={20} strokeWidth={1.7} />
          </span>
        </div>
        <strong className="stat-value">{money(s.incomeCents, currency)}</strong>
        <div className="stat-bottom">
          <span className="tiny-dot green-dot" />
          <span>
            <strong>{s.incomeCount}</strong> income {s.incomeCount === 1 ? "source" : "sources"}
          </span>
          <span className="stat-month-note">this month</span>
        </div>
      </section>
      <section className="stat-card">
        <div className="stat-top">
          <span>Total expenses</span>
          <span className="stat-icon peach-icon">
            <ArrowUpRight size={20} strokeWidth={1.7} />
          </span>
        </div>
        <strong className="stat-value">{money(s.expenseCents, currency)}</strong>
        <div className="stat-bottom">
          {s.previousExpenseCents > 0 && (
            <>
              <span className={`expense-change ${expenseChange > 0 ? "expense-up" : ""}`}>
                {expenseChange <= 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                {Math.abs(expenseChange).toFixed(1)}% {expenseChange <= 0 ? "less" : "more"}
              </span>
              <span>vs. last month</span>
            </>
          )}
          {!s.previousExpenseCents && <span>Your spending this month</span>}
        </div>
      </section>
      <section className="stat-card">
        <div className="stat-top">
          <span>Budget remaining</span>
          <span className="stat-icon sage-icon">
            <ChartPie size={19} strokeWidth={1.7} />
          </span>
        </div>
        <strong className={`stat-value ${remaining < 0 ? "negative-value" : ""}`}>{money(remaining, currency)}</strong>
        <div className="stat-bottom budget-stat-bottom">
          <div className="mini-progress">
            <span style={{ width: `${Math.min(100, used)}%` }} />
          </div>
          <span>{Math.round(used)}% of budget used</span>
        </div>
      </section>
    </div>
  );
}
export function BudgetOverview({
  data,
  onEdit,
  onManage,
}: {
  data: DashboardData;
  onEdit: (category: Category) => void;
  onManage: () => void;
}) {
  const active = data.budgets
    .filter(
      (b) => b.amountCents > 0 || data.transactions.some((t) => t.type === "expense" && t.category === b.category),
    )
    .slice(0, 4);
  return (
    <section className="card budget-overview">
      <div className="card-heading">
        <div>
          <h2>Monthly budgets</h2>
          <p>A plan for the things that matter</p>
        </div>
        <button className="icon-button" onClick={onManage} aria-label="Manage monthly budgets">
          <Pencil size={16} />
        </button>
      </div>
      <div className="budget-list">
        {active.length ? (
          active.map((b) => {
            const spent = data.transactions
              .filter((t) => t.type === "expense" && t.category === b.category)
              .reduce((sum, t) => sum + t.amountCents, 0);
            const percent = b.amountCents ? (spent / b.amountCents) * 100 : spent ? 100 : 0;
            return (
              <button className="budget-row" key={b.id} onClick={() => onEdit(b.category)}>
                <div className="budget-row-top">
                  <span className={`budget-category-icon category-${b.category.toLowerCase()}`}>
                    <CategoryIcon category={b.category} size={16} />
                  </span>
                  <strong>{b.category}</strong>
                  <span className="budget-amount">
                    {money(spent, data.user.currency)} <span>/ {money(b.amountCents, data.user.currency, false)}</span>
                  </span>
                </div>
                <div className="budget-row-bottom">
                  <div
                    className={`progress-track ${percent > 100 ? "over-budget" : percent >= 90 ? "near-budget" : ""}`}
                  >
                    <span style={{ width: `${Math.min(100, percent)}%` }} />
                  </div>
                  <span className={percent > 100 ? "over-budget-label" : ""}>{Math.round(percent)}%</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty-state small-empty">
            <span className="empty-icon">
              <Target size={26} />
            </span>
            <h3>Give your money a little direction</h3>
            <p>Set your first monthly budget.</p>
            <button className="button button-secondary button-small" onClick={onManage}>
              <Plus size={14} />
              Set a budget
            </button>
          </div>
        )}
      </div>
      <button className="budget-card-footer" onClick={onManage}>
        <span className="footer-check">
          <Check size={12} />
        </span>
        <span>
          {data.summary.expenseCents <= data.summary.budgetCents
            ? "Small steps. You’re on the right track."
            : "A little adjustment can make a big difference."}
        </span>
        <ArrowRight size={14} />
      </button>
    </section>
  );
}
export function BudgetsPage({
  data,
  onEdit,
  onAdd,
  onDelete,
}: {
  data: DashboardData;
  onEdit: (category: Category) => void;
  onAdd: () => void;
  onDelete: (id: string, category: Category) => void;
}) {
  const total = data.summary.budgetCents;
  const spent = data.summary.expenseCents;
  const percent = total ? (spent / total) * 100 : 0;
  return (
    <div className="budgets-page">
      <div className="budget-summary card">
        <div className="budget-summary-title">
          <span className="budget-summary-icon">
            <Target size={23} />
          </span>
          <div>
            <h2>Your monthly plan</h2>
            <p>Make room for what matters, one category at a time.</p>
          </div>
          <span className="month-chip">
            <CalendarDays size={14} />
            {monthLabel(data.month)}
          </span>
        </div>
        <div className="budget-summary-numbers">
          <div>
            <span>Total budget</span>
            <strong>{money(total, data.user.currency)}</strong>
          </div>
          <div>
            <span>Spent so far</span>
            <strong>{money(spent, data.user.currency)}</strong>
          </div>
          <div>
            <span>{total >= spent ? "Still available" : "Over budget"}</span>
            <strong className={total >= spent ? "green-text" : "negative-value"}>
              {money(Math.abs(total - spent), data.user.currency)}
            </strong>
          </div>
        </div>
        <div className={`progress-track ${percent > 100 ? "over-budget" : ""}`}>
          <span style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        <div className="budget-summary-caption">
          <span>{Math.round(percent)}% of your monthly budget used</span>
          <span>{total ? "You’ve got this." : "Start with one category."}</span>
        </div>
      </div>
      <div className="section-title-row">
        <div>
          <h2>
            Category budgets <span className="count-badge">{data.budgets.filter((b) => b.amountCents > 0).length}</span>
          </h2>
          <p>Click a card to adjust your monthly limit.</p>
        </div>
        <button className="button button-secondary button-small" onClick={onAdd}>
          <Plus size={15} />
          Add a budget
        </button>
      </div>
      <div className="category-budget-grid">
        {EXPENSE_CATEGORIES.map((category) => {
          const budget = data.budgets.find((b) => b.category === category);
          const categorySpent = data.transactions
            .filter((t) => t.type === "expense" && t.category === category)
            .reduce((sum, t) => sum + t.amountCents, 0);
          const limit = budget?.amountCents || 0;
          const usage = limit ? (categorySpent / limit) * 100 : 0;
          return (
            <section className={`card category-budget-card ${!budget ? "unset-budget" : ""}`} key={category}>
              <div className="category-budget-heading">
                <span className={`budget-category-icon category-${category.toLowerCase()}`}>
                  <CategoryIcon category={category} size={21} />
                </span>
                <h3>{category}</h3>
                {budget && (
                  <div className="category-budget-actions">
                    <button
                      className="icon-button"
                      onClick={() => onEdit(category)}
                      aria-label={`Edit ${category} budget`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button delete-action"
                      onClick={() => onDelete(budget.id, category)}
                      aria-label={`Remove ${category} budget`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {budget ? (
                <>
                  <div className="category-spent">
                    <strong>{money(categorySpent, data.user.currency)}</strong>
                    <span>of {money(limit, data.user.currency, false)}</span>
                  </div>
                  <div className={`progress-track ${usage > 100 ? "over-budget" : ""}`}>
                    <span style={{ width: `${Math.min(100, usage)}%` }} />
                  </div>
                  <div className="category-remaining">
                    <span className={usage > 100 ? "over-budget-label" : ""}>
                      {money(Math.abs(limit - categorySpent), data.user.currency)}{" "}
                      {usage > 100 ? "over budget" : "remaining"}
                    </span>
                    <strong>{Math.round(usage)}%</strong>
                  </div>
                  <button className="category-edit-button" onClick={() => onEdit(category)}>
                    Edit monthly limit
                    <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <div className="unset-budget-content">
                  <p>A little plan for {category.toLowerCase()}?</p>
                  <button className="text-button" onClick={() => onEdit(category)}>
                    <Plus size={14} />
                    Set a budget
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="gentle-tip">
        <Sprout size={23} />
        <div>
          <strong>Budgets are a guide, not a rulebook.</strong>
          <p>Life happens. Adjust your limits as your needs change.</p>
        </div>
      </div>
    </div>
  );
}
export function ReportsPage({ data }: { data: DashboardData }) {
  const categories = categoryTotals(data.transactions);
  const biggest = categories[0];
  const net = data.summary.incomeCents - data.summary.expenseCents;
  const savings = data.summary.incomeCents ? Math.round((net / data.summary.incomeCents) * 100) : 0;
  const days = new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5)), 0).getDate();
  return (
    <div className="reports-page">
      <div className="insight-grid">
        <section className="card insight-card">
          <span className="insight-icon">
            <TrendingUp size={21} />
          </span>
          <div>
            <span>Savings rate</span>
            <strong>{savings}%</strong>
            <p>{net >= 0 ? "A little more room for your future" : "Your expenses are above your income"}</p>
          </div>
        </section>
        <section className="card insight-card">
          <span className="insight-icon">
            <ChartPie size={21} />
          </span>
          <div>
            <span>Biggest spending category</span>
            <strong className="insight-category">{biggest?.category || "Not yet"}</strong>
            <p>
              {biggest
                ? `${money(biggest.amountCents, data.user.currency)} · ${Math.round((biggest.amountCents / data.summary.expenseCents) * 100)}% of expenses`
                : "Add an expense to see your breakdown"}
            </p>
          </div>
        </section>
        <section className="card insight-card">
          <span className="insight-icon">
            <CalendarDays size={21} />
          </span>
          <div>
            <span>Average daily spending</span>
            <strong>{money(Math.round(data.summary.expenseCents / days), data.user.currency)}</strong>
            <p>Based on the days in {monthLabel(data.month).split(" ")[0]}</p>
          </div>
        </section>
      </div>
      <div className="report-trends">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>The bigger picture</h2>
              <p>Six months of small steps and steady progress</p>
            </div>
            <span className="month-chip">
              <CalendarDays size={14} />
              6-month view
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Expenses</th>
                  <th>Net savings</th>
                  <th>Savings rate</th>
                </tr>
              </thead>
              <tbody>
                {[...data.trends].reverse().map((trend) => {
                  const trendNet = trend.incomeCents - trend.expenseCents;
                  return (
                    <tr key={trend.month}>
                      <td>
                        <strong>{monthLabel(trend.month)}</strong>
                      </td>
                      <td className="positive-amount">{money(trend.incomeCents, data.user.currency)}</td>
                      <td>{money(trend.expenseCents, data.user.currency)}</td>
                      <td className={trendNet >= 0 ? "positive-amount" : "negative-value"}>
                        {trendNet >= 0 ? "+" : "−"}
                        {money(Math.abs(trendNet), data.user.currency)}
                      </td>
                      <td>
                        <span className={`report-rate ${trendNet < 0 ? "negative-value" : ""}`}>
                          {trend.incomeCents ? Math.round((trendNet / trend.incomeCents) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="report-note">
          <span className="report-note-icon">
            <Sprout size={31} strokeWidth={1.4} />
          </span>
          <h2>Progress, not perfection.</h2>
          <p>
            Every transaction tells a little story. Your reports help you see the patterns, celebrate the wins, and make
            space for what’s next.
          </p>
          <div>
            <Check size={15} />
            Clarity looks good on you.
          </div>
        </aside>
      </div>
    </div>
  );
}
