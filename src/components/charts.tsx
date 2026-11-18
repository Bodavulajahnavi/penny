"use client";
import { useMemo, useState } from "react";
import { Chart as ChartJS, registerables, type ChartOptions, type ScriptableContext } from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { categoryTotals, compactMoney, money, monthLabel, type Transaction, type MonthSummary } from "@/lib/finance";
ChartJS.register(...registerables);
ChartJS.defaults.font.family = "'Inter Variable', sans-serif";
ChartJS.defaults.color = "#8b948e";

export function CashFlowChart({
  transactions,
  trends,
  month,
  currency,
}: {
  transactions: Transaction[];
  trends: MonthSummary[];
  month: string;
  currency: string;
}) {
  const [range, setRange] = useState("month");
  const { labels, income, expenses } = useMemo(() => {
    if (range === "six")
      return {
        labels: trends.map((t) => monthLabel(t.month, true).split(" ")[0]),
        income: trends.map((t) => t.incomeCents),
        expenses: trends.map((t) => t.expenseCents),
      };
    const [year, m] = month.split("-").map(Number);
    const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const items = transactions.filter((t) => t.date.startsWith(month));
    const income: number[] = [],
      expenses: number[] = [],
      labels: string[] = [];
    for (let day = 1; day <= count; day++) {
      const daily = items.filter((t) => Number(t.date.slice(-2)) === day);
      income.push(
        (income[day - 2] || 0) + daily.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0),
      );
      expenses.push(
        (expenses[day - 2] || 0) + daily.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCents, 0),
      );
      labels.push(`${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`);
    }
    return { labels, income, expenses };
  }, [range, transactions, trends, month]);
  const gradient = (context: ScriptableContext<"line">) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return "rgba(73, 130, 91, 0.08)";
    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, "rgba(73, 130, 91, 0.13)");
    g.addColorStop(1, "rgba(73, 130, 91, 0.005)");
    return g;
  };
  const max = Math.max(...income, ...expenses, 10000);
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    animation: { duration: 450 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#285c43",
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 12, weight: 500 },
        bodyFont: { size: 12 },
        callbacks: { label: (item) => ` ${item.dataset.label}: ${money(Number(item.raw), currency)}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { maxTicksLimit: 7, maxRotation: 0, font: { size: 10 }, padding: 8, color: "#929a94" },
      },
      y: {
        border: { display: false },
        grid: { color: "#f0f3ef", drawTicks: false },
        ticks: {
          count: 5,
          padding: 12,
          font: { size: 10 },
          callback: (value) => compactMoney(Number(value), currency),
        },
        suggestedMax: Math.ceil(max / 100000) * 100000,
      },
    },
  };
  return (
    <section className="card cashflow-card">
      <div className="card-heading">
        <div>
          <h2>Cash flow</h2>
          <p>Your income and expenses over time</p>
        </div>
        <div className="chart-select">
          <select aria-label="Cash flow period" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="month">This month</option>
            <option value="six">Last 6 months</option>
          </select>
          <ChevronDown size={13} />
        </div>
      </div>
      <div className="line-chart">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: "Income",
                data: income,
                borderColor: "#3b7a57",
                backgroundColor: (context) => gradient(context),
                fill: true,
                tension: 0.35,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: "#3b7a57",
                pointHoverBorderColor: "#fff",
                pointHoverBorderWidth: 2,
              },
              {
                label: "Expenses",
                data: expenses,
                borderColor: "#a2b9a2",
                borderDash: [4, 4],
                fill: false,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: "#a2b9a2",
                pointHoverBorderColor: "#fff",
                pointHoverBorderWidth: 2,
              },
            ],
          }}
          options={options}
        />
      </div>
      <div className="chart-legend">
        <span>
          <i style={{ background: "#3b7a57" }} />
          Income
        </span>
        <span>
          <i style={{ background: "#a2b9a2" }} />
          Expenses
        </span>
        <span className="chart-period-note">{range === "month" ? "Cumulative this month" : "Monthly totals"}</span>
      </div>
    </section>
  );
}

export function SpendingChart({
  transactions,
  currency,
  onReport,
}: {
  transactions: Transaction[];
  currency: string;
  onReport?: () => void;
}) {
  const totals = categoryTotals(transactions);
  const total = totals.reduce((s, t) => s + t.amountCents, 0);
  return (
    <section className="card spending-card">
      <div className="card-heading">
        <div>
          <h2>Spending breakdown</h2>
          <p>A little perspective on your spending</p>
        </div>
        <span className="subtle-icon">
          <ArrowUpRight size={17} />
        </span>
      </div>
      <div className="donut-wrap">
        <Doughnut
          data={{
            labels: totals.map((t) => t.category),
            datasets: [
              {
                data: totals.length ? totals.map((t) => t.amountCents) : [1],
                backgroundColor: totals.length ? totals.map((t) => t.color) : ["#edf1eb"],
                borderWidth: 0,
                borderRadius: 4,
                spacing: 3,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: "79%",
            animation: { duration: 600 },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: total > 0,
                backgroundColor: "#285c43",
                padding: 10,
                cornerRadius: 7,
                callbacks: { label: (item) => ` ${money(Number(item.raw), currency)}` },
              },
            },
          }}
        />
        <div className="donut-center">
          <span>Total spent</span>
          <strong>{money(total, currency)}</strong>
          <small>{transactions.filter((t) => t.type === "expense").length} transactions</small>
        </div>
      </div>
      <div className="spending-legend">
        {totals.length ? (
          totals.map((t) => (
            <div key={t.category}>
              <span>
                <i style={{ background: t.color }} />
                {t.category}
              </span>
              <strong>
                {((t.amountCents / total) * 100).toFixed(1)}
                <span>%</span>
              </strong>
            </div>
          ))
        ) : (
          <p className="empty-chart">Your next transaction starts the story.</p>
        )}
      </div>
      {onReport && (
        <button className="chart-report-link" onClick={onReport}>
          View spending report <ArrowUpRight size={13} />
        </button>
      )}
    </section>
  );
}
