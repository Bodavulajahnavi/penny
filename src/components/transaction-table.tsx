"use client";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Trash2,
  ReceiptText,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CATEGORIES, dateLabel, money, today, type Transaction } from "@/lib/finance";
import { CategoryIcon } from "@/components/icons";
interface Props {
  transactions: Transaction[];
  currency: string;
  compact?: boolean;
  search: string;
  onSearch: (s: string) => void;
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onViewAll?: () => void;
  onExport: (items: Transaction[]) => void;
}
export function TransactionTable({
  transactions,
  currency,
  compact = false,
  search,
  onSearch,
  onAdd,
  onEdit,
  onDelete,
  onViewAll,
  onExport,
}: Props) {
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date-desc");
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const pageSize = compact ? 5 : 8;
  const filtered = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            (type === "all" || t.type === type) &&
            (category === "all" || t.category === category) &&
            (!search ||
              `${t.description} ${t.category} ${t.account} ${t.amountCents / 100}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (!from || t.date >= from) &&
            (!to || t.date <= to),
        )
        .sort((a, b) =>
          sort === "amount-high"
            ? b.amountCents - a.amountCents
            : sort === "amount-low"
              ? a.amountCents - b.amountCents
              : sort === "date-asc"
                ? a.date.localeCompare(b.date)
                : b.date.localeCompare(a.date),
        ),
    [transactions, type, category, search, from, to, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasFilters = !!search || type !== "all" || category !== "all" || !!from || !!to;
  function clearFilters() {
    onSearch("");
    setType("all");
    setCategory("all");
    setFrom("");
    setTo("");
    setPage(1);
  }
  return (
    <section className={`card transaction-card ${compact ? "compact-table" : "full-table"}`}>
      <div className="card-heading transaction-heading">
        <div>
          <h2>
            {compact ? "Recent transactions" : "All transactions"}
            <span className="count-badge">{transactions.length}</span>
          </h2>
          <p>{compact ? "Your latest ins and outs" : "A clear picture of your everyday finances"}</p>
        </div>
        {compact ? (
          <button className="text-button" onClick={onViewAll}>
            View all <ArrowUpRight size={15} />
          </button>
        ) : (
          <button
            className="button button-secondary button-small"
            onClick={() => onExport(filtered)}
            disabled={!filtered.length}
          >
            <Download size={15} />
            Export CSV
          </button>
        )}
      </div>
      {!compact && (
        <div className="table-toolbar">
          <div className="transaction-tabs">
            {[
              ["all", "All transactions"],
              ["income", "Income"],
              ["expense", "Expenses"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={type === value ? "active" : ""}
                onClick={() => {
                  setType(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="table-filter-actions">
            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className={`button button-secondary button-small ${showFilters ? "filter-active" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={14} />
              Filters{(from || to) && <i className="active-dot" />}
            </button>
          </div>
        </div>
      )}
      {showFilters && (
        <div className="advanced-filters">
          <label>
            From date
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={today()}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-high">Amount: high to low</option>
              <option value="amount-low">Amount: low to high</option>
            </select>
          </label>
          <button className="text-button" onClick={clearFilters}>
            <X size={13} />
            Reset
          </button>
        </div>
      )}
      {search && (
        <div className="search-results-note">
          Results for <strong>“{search}”</strong>
          <button onClick={() => onSearch("")} aria-label="Clear search">
            <X size={13} />
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Category</th>
              <th>Date</th>
              <th className="amount-column">Amount</th>
              <th className="actions-column">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="transaction-description">
                    <span
                      className={`category-icon ${t.type === "income" ? "income-icon" : ""}`}
                      style={{
                        color:
                          t.type === "income"
                            ? "#3b7a57"
                            : ["Food", "Rent", "Transport", "Entertainment", "Shopping", "Other", "Salary"].includes(
                                  t.category,
                                )
                              ? undefined
                              : "#718075",
                      }}
                    >
                      <CategoryIcon category={t.category} size={18} />
                    </span>
                    <div>
                      <strong>{t.description}</strong>
                      <small>{t.account}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`category-badge ${t.category === "Food" ? "food-badge" : t.category === "Rent" ? "rent-badge" : t.category === "Transport" ? "transport-badge" : t.category === "Salary" ? "salary-badge" : ""}`}
                  >
                    {t.category}
                  </span>
                </td>
                <td className="date-cell">{dateLabel(t.date)}</td>
                <td className={`amount-column amount-cell ${t.type === "income" ? "positive-amount" : ""}`}>
                  {t.type === "income" ? "+" : "−"}
                  {money(t.amountCents, currency)}
                </td>
                <td className="actions-column">
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      onClick={() => onEdit(t)}
                      aria-label={`Edit ${t.description}`}
                      title="Edit transaction"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button delete-action"
                      onClick={() => onDelete(t)}
                      aria-label={`Delete ${t.description}`}
                      title="Delete transaction"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <div className="empty-state">
          <span className="empty-icon">
            <ReceiptText size={29} strokeWidth={1.4} />
          </span>
          <h3>{hasFilters ? "No matching transactions" : "A fresh start for your finances"}</h3>
          <p>
            {hasFilters
              ? "Try another search or clear your filters."
              : "Add your first income or expense. We’ll take care of the bigger picture."}
          </p>
          <button className="button button-secondary button-small" onClick={hasFilters ? clearFilters : onAdd}>
            {hasFilters ? <SearchX size={15} /> : <ArrowUpRight size={15} />}
            {hasFilters ? "Clear filters" : "Add a transaction"}
          </button>
        </div>
      )}
      <div className="table-footer">
        <span>
          {filtered.length
            ? `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} transactions`
            : "No transactions to show"}
        </span>
        {compact ? (
          <span className="table-footer-note">
            <span className="saved-dot" />
            All changes saved
          </span>
        ) : (
          <div className="pagination">
            <button
              className="icon-button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {safePage} of {pages}
            </span>
            <button
              className="icon-button"
              disabled={safePage >= pages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
