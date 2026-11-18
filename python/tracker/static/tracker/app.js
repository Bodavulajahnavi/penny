/* penny's standalone Django client. All data is scoped by the authenticated session. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const attr = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const money = (cents, decimals = true) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: state.data.user.currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    }).format(cents / 100);
  const monthName = (month) =>
    new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const dateName = (date) =>
    new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const today = new Date().toISOString().slice(0, 10);
  const categories = ["Food", "Rent", "Transport", "Entertainment", "Shopping", "Other"];
  const colors = {
    Food: "#347858",
    Rent: "#83ae93",
    Transport: "#b9d0bd",
    Entertainment: "#e0e9dd",
    Shopping: "#b99768",
    Other: "#9caeb9",
    Salary: "#347858",
  };
  const paths = {
    overview:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    transactions: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
    budgets: '<path d="M21 12a9 9 0 1 1-9-9v9Z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15Z"/>',
    reports: '<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',
    settings:
      '<path d="m9 3-.7 2.1-2 .9-2.1-.5-1.5 2.6 1.4 1.6-.2 2.3L2.5 14 4 16.6l2.2-.4 1.9 1.2.6 2.1h3l.7-2.1 2-.9 2.1.5 1.5-2.6-1.4-1.6.2-2.3 1.4-1.6L17 6.3l-2.2.4-1.9-1.2-.6-2.1Z"/><circle cx="10.5" cy="11.5" r="3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    Food: '<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M18 3c-3 3-3 7 0 8h2V3h-2Zm2 8v10"/>',
    Rent: '<path d="m3 10 9-7 9 7v10H3ZM9 20v-7h6v7"/>',
    Transport: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 10h14M8 18v3m8-3v3M8 14h1m6 0h1"/>',
    Entertainment: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 8 18-4M7 3v5m5-6v5m5-4v5"/>',
    Salary: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-10 0v3h2"/>',
    Shopping: '<path d="M5 7h14l2 14H3ZM8 7V5a4 4 0 0 1 8 0v2"/>',
    Other: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8m-4-4v8"/>',
  };
  const icon = (name, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.Other}</svg>`;
  const state = {
    data: document.getElementById("penny-data") ? JSON.parse(document.getElementById("penny-data").textContent) : null,
    view: window.PENNY_VIEW || "overview",
    search: "",
    type: "all",
    category: "all",
    from: "",
    to: "",
    sort: "date-desc",
    page: 1,
    range: "month",
    busy: false,
  };
  let lineChart, doughnutChart, previousFocus;
  const headings = {
    overview: ["Welcome back", "Let’s make every penny count."],
    transactions: ["Your transactions", "The little details behind your bigger picture."],
    budgets: ["A little plan. A lot of possibility.", "Give every penny a purpose with monthly budgets."],
    reports: ["Your money, in perspective.", "Find the patterns. Celebrate the progress."],
    settings: ["Your space, your way.", "The little details that make penny yours."],
  };

  async function api(path, method = "GET", body) {
    const csrf = document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrftoken="))
      ?.split("=")
      .slice(1)
      .join("=");
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRFToken": decodeURIComponent(csrf) } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 204) return;
    const result = await response.json().catch(() => ({}));
    const signedOut =
      response.status === 401 || (response.status === 403 && /credentials|csrf/i.test(String(result.detail || "")));
    if (signedOut && !path.startsWith("/api/auth")) {
      window.location.assign("/?view=login");
      throw new Error("Please sign in to continue.");
    }
    if (!response.ok) {
      const error = result.non_field_errors || result.detail || Object.values(result)[0];
      throw new Error(Array.isArray(error) ? error.join(" ") : String(error || "Something went wrong."));
    }
    return result;
  }
  function toast(message, error = false) {
    const el = $("#toast");
    el.textContent = (error ? "⚠ " : "✓ ") + message;
    el.className = "toast" + (error ? " toast-error" : "");
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      el.hidden = true;
    }, 5000);
  }
  function offsetMonth(offset) {
    const [year, month] = state.data.month.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
  }
  async function loadMonth(month) {
    if (month === state.data.month || !/^\d{4}-\d{2}$/.test(month)) return;
    const line = document.createElement("div");
    line.className = "loading-line";
    $(".workspace").prepend(line);
    try {
      state.data = await api("/api/dashboard/?month=" + month);
      state.page = 1;
      render();
    } catch (error) {
      toast(error.message, true);
    } finally {
      line.remove();
    }
  }
  function navigate(view) {
    state.view = view;
    state.page = 1;
    state.search = "";
    state.type = "all";
    state.category = "all";
    state.from = "";
    state.to = "";
    $("#global-search").value = "";
    history.pushState({}, "", view === "overview" ? "/" : "/?view=" + view);
    closePopovers();
    $("#sidebar").classList.remove("sidebar-open");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function summaryCards() {
    const s = state.data.summary;
    const remaining = s.budgetCents - s.expenseCents;
    const used = s.budgetCents ? Math.round((s.expenseCents / s.budgetCents) * 100) : 0;
    const change = s.previousExpenseCents
      ? ((s.expenseCents - s.previousExpenseCents) / s.previousExpenseCents) * 100
      : 0;
    return `<div class="summary-grid"><section class="stat-card balance-stat"><div class="stat-top"><span>Total balance</span><span class="stat-icon">◫</span></div><strong class="stat-value">${money(s.balanceCents)}</strong><div class="stat-bottom"><span class="balance-gain">↗ ${s.incomeCents - s.expenseCents >= 0 ? "+" : ""}${money(s.incomeCents - s.expenseCents)}</span><span>this month</span></div></section><section class="stat-card"><div class="stat-top"><span>Total income</span><span class="stat-icon green-icon">↙</span></div><strong class="stat-value">${money(s.incomeCents)}</strong><div class="stat-bottom"><span class="tiny-dot green-dot"></span><span><strong>${s.incomeCount}</strong> income sources</span></div></section><section class="stat-card"><div class="stat-top"><span>Total expenses</span><span class="stat-icon peach-icon">↗</span></div><strong class="stat-value">${money(s.expenseCents)}</strong><div class="stat-bottom">${s.previousExpenseCents ? `<span class="expense-change">${change <= 0 ? "↙" : "↗"} ${Math.abs(change).toFixed(1)}% ${change <= 0 ? "less" : "more"}</span><span>vs. last month</span>` : "<span>Your spending this month</span>"}</div></section><section class="stat-card"><div class="stat-top"><span>Budget remaining</span><span class="stat-icon sage-icon">◕</span></div><strong class="stat-value ${remaining < 0 ? "negative-value" : ""}">${money(remaining)}</strong><div class="stat-bottom budget-stat-bottom"><div class="mini-progress"><span style="width:${Math.min(100, used)}%"></span></div><span>${used}% of budget used</span></div></section></div>`;
  }
  function chartCards() {
    return `<div class="dashboard-grid chart-row"><section class="card cashflow-card"><div class="card-heading"><div><h2>Cash flow</h2><p>Your income and expenses over time</p></div><div class="chart-select"><select id="chart-period" aria-label="Cash flow period"><option value="month">This month</option><option value="six">Last 6 months</option></select></div></div><div class="line-chart"><canvas id="cash-line" aria-label="Income and expenses line chart" role="img"></canvas></div><div class="chart-legend"><span><i style="background:#3b7a57"></i>Income</span><span><i style="background:#a2b9a2"></i>Expenses</span><span class="chart-period-note">Cumulative this month</span></div></section><section class="card spending-card"><div class="card-heading"><div><h2>Spending breakdown</h2><p>A little perspective on your spending</p></div><span class="subtle-icon">↗</span></div><div class="donut-wrap"><canvas id="spending-donut" role="img" aria-label="Spending by category"></canvas><div class="donut-center"><span>Total spent</span><strong>${money(state.data.summary.expenseCents)}</strong><small>${state.data.transactions.filter((t) => t.type === "expense").length} transactions</small></div></div><div class="spending-legend">${
      spendingTotals()
        .map(
          (t) =>
            `<div><span><i style="background:${t.color}"></i>${t.category}</span><strong>${((t.amount / state.data.summary.expenseCents) * 100).toFixed(1)}<span>%</span></strong></div>`,
        )
        .join("") || '<p class="empty-chart">Your next transaction starts the story.</p>'
    }</div><button class="chart-report-link" data-action="reports">View spending report ↗</button></section></div>`;
  }
  function spendingTotals() {
    return categories
      .map((category) => ({
        category,
        color: colors[category],
        amount: state.data.transactions
          .filter((t) => t.type === "expense" && t.category === category)
          .reduce((s, t) => s + t.amountCents, 0),
      }))
      .filter((t) => t.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }
  function filteredTransactions() {
    return state.data.transactions
      .filter(
        (t) =>
          (state.type === "all" || t.type === state.type) &&
          (state.category === "all" || t.category === state.category) &&
          (!state.search ||
            `${t.description} ${t.category} ${t.account} ${t.amountCents / 100}`
              .toLowerCase()
              .includes(state.search.toLowerCase())) &&
          (!state.from || t.date >= state.from) &&
          (!state.to || t.date <= state.to),
      )
      .sort((a, b) =>
        state.sort === "amount-high"
          ? b.amountCents - a.amountCents
          : state.sort === "amount-low"
            ? a.amountCents - b.amountCents
            : state.sort === "date-asc"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date),
      );
  }
  function table(compact = false) {
    const items = filteredTransactions();
    const size = compact ? 5 : 8;
    const pages = Math.max(1, Math.ceil(items.length / size));
    state.page = Math.min(state.page, pages);
    const visible = items.slice((state.page - 1) * size, state.page * size);
    const hasFilters = state.search || state.type !== "all" || state.category !== "all" || state.from || state.to;
    return `<section class="card transaction-card ${compact ? "compact-table" : "full-table"}"><div class="card-heading transaction-heading"><div><h2>${compact ? "Recent transactions" : "All transactions"}<span class="count-badge">${state.data.transactions.length}</span></h2><p>${compact ? "Your latest ins and outs" : "A clear picture of your everyday finances"}</p></div>${compact ? '<button class="text-button" data-action="transactions">View all ↗</button>' : `<button class="button button-secondary button-small" data-action="export">Export CSV</button>`}</div>${
      compact
        ? ""
        : `<div class="table-toolbar"><div class="transaction-tabs">${[
            ["all", "All transactions"],
            ["income", "Income"],
            ["expense", "Expenses"],
          ]
            .map(
              ([value, label]) =>
                `<button class="${state.type === value ? "active" : ""}" data-action="filter-type" data-value="${value}">${label}</button>`,
            )
            .join(
              "",
            )}</div><div class="table-filter-actions"><select id="category-filter" aria-label="Filter by category"><option value="all">All categories</option>${[...categories, "Salary"].map((c) => `<option ${state.category === c ? "selected" : ""}>${c}</option>`).join("")}</select><button class="button button-secondary button-small" data-action="filters">${icon("settings", 14)} Filters</button></div></div><div class="advanced-filters" ${state.showFilters ? "" : "hidden"}><label>From date<input id="from-date" type="date" value="${attr(state.from)}"></label><label>To date<input id="to-date" type="date" value="${attr(state.to)}"></label><label>Sort by<select id="sort-transactions">${[
            ["date-desc", "Newest first"],
            ["date-asc", "Oldest first"],
            ["amount-high", "Amount: high to low"],
            ["amount-low", "Amount: low to high"],
          ]
            .map(([v, l]) => `<option value="${v}" ${state.sort === v ? "selected" : ""}>${l}</option>`)
            .join(
              "",
            )}</select></label><button class="text-button" data-action="clear-filters" aria-label="Reset">Reset ×</button></div>`
    }${state.search ? `<div class="search-results-note">Results for <strong>“${attr(state.search)}”</strong></div>` : ""}<div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th class="amount-column">Amount</th><th class="actions-column"><span class="sr-only">Actions</span></th></tr></thead><tbody>${visible.map((t) => `<tr><td><div class="transaction-description"><span class="category-icon ${t.type === "income" ? "income-icon" : ""}">${icon(t.category, 18)}</span><div><strong>${attr(t.description)}</strong><small>${attr(t.account)}</small></div></div></td><td><span class="category-badge category-${t.category.toLowerCase()}">${t.category}</span></td><td class="date-cell">${dateName(t.date)}</td><td class="amount-column amount-cell ${t.type === "income" ? "positive-amount" : ""}">${t.type === "income" ? "+" : "−"}${money(t.amountCents)}</td><td class="actions-column"><div class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${t.id}" aria-label="Edit ${attr(t.description)}">✎</button><button class="icon-button delete-action" data-action="delete-transaction" data-id="${t.id}" aria-label="Delete ${attr(t.description)}">♻</button></div></td></tr>`).join("")}</tbody></table></div>${visible.length ? "" : `<div class="empty-state"><span class="empty-icon">▤</span><h3>${hasFilters ? "No matching transactions" : "A fresh start for your finances"}</h3><p>${hasFilters ? "Try another search or clear your filters." : "Add your first income or expense. We’ll take care of the bigger picture."}</p><button class="button button-secondary button-small" data-action="${hasFilters ? "clear-filters" : "add-transaction"}">${hasFilters ? "Clear filters" : "+ Add a transaction"}</button></div>`}<div class="table-footer"><span>${items.length ? `Showing ${(state.page - 1) * size + 1}–${Math.min(state.page * size, items.length)} of ${items.length} transactions` : "No transactions to show"}</span>${compact ? '<span class="table-footer-note">● All changes saved</span>' : `<div class="pagination"><button class="icon-button" data-action="previous-page" ${state.page === 1 ? "disabled" : ""} aria-label="Previous page">‹</button><span>Page ${state.page} of ${pages}</span><button class="icon-button" data-action="next-page" ${state.page === pages ? "disabled" : ""} aria-label="Next page">›</button></div>`}</div></section>`;
  }
  function budgetOverview() {
    const budgets = state.data.budgets
      .filter(
        (b) =>
          b.amountCents > 0 || state.data.transactions.some((t) => t.category === b.category && t.type === "expense"),
      )
      .slice(0, 4);
    return `<section class="card budget-overview"><div class="card-heading"><div><h2>Monthly budgets</h2><p>A plan for the things that matter</p></div><button class="icon-button" data-action="budgets" aria-label="Manage budgets">✎</button></div><div class="budget-list">${
      budgets
        .map((b) => {
          const spent = state.data.transactions
            .filter((t) => t.category === b.category && t.type === "expense")
            .reduce((s, t) => s + t.amountCents, 0);
          const percent = b.amountCents ? Math.round((spent / b.amountCents) * 100) : 100;
          return `<button class="budget-row" data-action="edit-budget" data-category="${b.category}"><div class="budget-row-top"><span class="budget-category-icon category-${b.category.toLowerCase()}">${icon(b.category, 16)}</span><strong>${b.category}</strong><span class="budget-amount">${money(spent)} <span>/ ${money(b.amountCents, false)}</span></span></div><div class="budget-row-bottom"><div class="progress-track ${percent > 100 ? "over-budget" : percent >= 90 ? "near-budget" : ""}"><span style="width:${Math.min(100, percent)}%"></span></div><span>${percent}%</span></div></button>`;
        })
        .join("") ||
      '<div class="empty-state small-empty"><h3>Give your money a little direction.</h3><p>Set your first monthly budget.</p></div>'
    }</div><button class="budget-card-footer" data-action="budgets"><span class="footer-check">✓</span>Small steps. You’re on the right track.<span>→</span></button></section>`;
  }
  function budgetPage() {
    const s = state.data.summary;
    const percent = s.budgetCents ? Math.round((s.expenseCents / s.budgetCents) * 100) : 0;
    return `<section class="card budget-summary"><div class="budget-summary-title"><span class="budget-summary-icon">◎</span><div><h2>Your monthly plan</h2><p>Make room for what matters, one category at a time.</p></div><span class="month-chip">${monthName(state.data.month)}</span></div><div class="budget-summary-numbers"><div><span>Total budget</span><strong>${money(s.budgetCents)}</strong></div><div><span>Spent so far</span><strong>${money(s.expenseCents)}</strong></div><div><span>${s.budgetCents >= s.expenseCents ? "Still available" : "Over budget"}</span><strong>${money(Math.abs(s.budgetCents - s.expenseCents))}</strong></div></div><div class="progress-track ${percent > 100 ? "over-budget" : ""}"><span style="width:${Math.min(100, percent)}%"></span></div><div class="budget-summary-caption"><span>${percent}% of your monthly budget used</span><span>You’ve got this.</span></div></section><div class="section-title-row"><div><h2>Category budgets</h2><p>Click a card to adjust your monthly limit.</p></div><button class="button button-secondary button-small" data-action="add-budget">+ Add a budget</button></div><div class="category-budget-grid">${categories
      .map((category) => {
        const b = state.data.budgets.find((b) => b.category === category);
        const spent = state.data.transactions
          .filter((t) => t.category === category && t.type === "expense")
          .reduce((s, t) => s + t.amountCents, 0);
        const percent = b?.amountCents ? Math.round((spent / b.amountCents) * 100) : 0;
        return `<section class="card category-budget-card ${b ? "" : "unset-budget"}"><div class="category-budget-heading"><span class="budget-category-icon category-${category.toLowerCase()}">${icon(category, 21)}</span><h3>${category}</h3>${b ? `<div class="category-budget-actions"><button class="icon-button" data-action="edit-budget" data-category="${category}" aria-label="Edit budget">✎</button><button class="icon-button delete-action" data-action="delete-budget" data-id="${b.id}" aria-label="Remove ${category} budget">♻</button></div>` : ""}</div>${b ? `<div class="category-spent"><strong>${money(spent)}</strong><span>of ${money(b.amountCents, false)}</span></div><div class="progress-track ${percent > 100 ? "over-budget" : ""}"><span style="width:${Math.min(100, percent)}%"></span></div><div class="category-remaining"><span class="${percent > 100 ? "over-budget-label" : ""}">${money(Math.abs(b.amountCents - spent))} ${percent > 100 ? "over budget" : "remaining"}</span><strong>${percent}%</strong></div><button class="category-edit-button" data-action="edit-budget" data-category="${category}">Edit monthly limit →</button>` : `<div class="unset-budget-content"><p>A little plan for ${category.toLowerCase()}?</p><button class="text-button" data-action="edit-budget" data-category="${category}">+ Set a budget</button></div>`}</section>`;
      })
      .join(
        "",
      )}</div><div class="gentle-tip"><span>♧</span><div><strong>Budgets are a guide, not a rulebook.</strong><p>Life happens. Adjust your limits as your needs change.</p></div></div>`;
  }
  function reportsPage() {
    const s = state.data.summary;
    const biggest = spendingTotals()[0];
    const net = s.incomeCents - s.expenseCents;
    const rate = s.incomeCents ? Math.round((net / s.incomeCents) * 100) : 0;
    const days = new Date(Number(state.data.month.slice(0, 4)), Number(state.data.month.slice(5)), 0).getDate();
    return `<div class="insight-grid"><section class="card insight-card"><span class="insight-icon">↗</span><div><span>Savings rate</span><strong>${rate}%</strong><p>${net >= 0 ? "A little more room for your future" : "Your expenses are above your income"}</p></div></section><section class="card insight-card"><span class="insight-icon">◕</span><div><span>Biggest spending category</span><strong class="insight-category">${biggest?.category || "Not yet"}</strong><p>${biggest ? money(biggest.amount) + " in expenses" : "Add an expense to see your breakdown"}</p></div></section><section class="card insight-card"><span class="insight-icon">▦</span><div><span>Average daily spending</span><strong>${money(Math.round(s.expenseCents / days))}</strong><p>Based on the days in ${monthName(state.data.month).split(" ")[0]}</p></div></section></div>${chartCards()}<section class="card report-trends"><div class="card-heading"><div><h2>The bigger picture</h2><p>Six months of small steps and steady progress</p></div></div><div class="table-scroll"><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net savings</th><th>Savings rate</th></tr></thead><tbody>${[
      ...state.data.trends,
    ]
      .reverse()
      .map(
        (t) =>
          `<tr><td><strong>${monthName(t.month)}</strong></td><td class="positive-amount">${money(t.incomeCents)}</td><td>${money(t.expenseCents)}</td><td class="${t.incomeCents >= t.expenseCents ? "positive-amount" : "negative-value"}">${money(t.incomeCents - t.expenseCents)}</td><td><span class="report-rate">${t.incomeCents ? Math.round(((t.incomeCents - t.expenseCents) / t.incomeCents) * 100) : 0}%</span></td></tr>`,
      )
      .join("")}</tbody></table></div></section>`;
  }
  function settingsPage() {
    const u = state.data.user;
    return `<div class="settings-grid"><section class="card settings-card"><div class="card-heading"><div><h2>Account details</h2><p>Make this little space your own</p></div></div><div class="settings-profile"><span class="avatar avatar-large">${attr(
      u.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join(""),
    )}</span><div><strong>${attr(u.name)}</strong><span>${u.isDemo ? "Demo account" : "Personal account"}</span></div></div><form class="app-form" id="profile-form"><label>Full name<input name="name" value="${attr(u.name)}" minlength="2" maxlength="100" required></label><label>Email address<input name="email" type="email" value="${attr(u.email)}" maxlength="254" required></label><label>Display currency<select aria-label="Display currency" name="currency">${[
      ["USD", "USD — US Dollar"],
      ["EUR", "EUR — Euro"],
      ["GBP", "GBP — British Pound"],
      ["INR", "INR — Indian Rupee"],
    ]
      .map(([v, l]) => `<option value="${v}" ${u.currency === v ? "selected" : ""}>${l}</option>`)
      .join(
        "",
      )}</select></label><p class="field-note">Changes the display symbol only; amounts are not converted.</p><button type="button" class="text-button" data-action="change-password">Change password</button><div class="password-fields" id="password-fields" hidden><label>Current password<input name="current_password" type="password" autocomplete="current-password"></label><label>New password<input name="new_password" type="password" autocomplete="new-password" minlength="8" maxlength="128"></label></div><div id="profile-error" class="form-error" role="alert" hidden></div><button class="button button-primary" type="submit">✓ Save changes</button></form></section><div class="settings-side"><section class="card settings-card"><div class="card-heading"><div><h2>Your data, your way</h2><p>Take your transactions with you</p></div></div><div class="security-content"><p>Download this month’s transactions as a CSV, ready for your spreadsheet.</p><button class="button button-secondary" data-action="export">Export transactions</button></div></section><div class="demo-account-note"><p>Your data is stored in your account’s private SQLite workspace. Your session keeps you signed in on this device.</p></div><button class="logout-button" data-action="logout">Sign out of penny</button></div></div>`;
  }
  function render() {
    const u = state.data.user;
    const initials = u.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("");
    const heading = headings[state.view];
    $("#page-title").textContent = state.view === "overview" ? `Welcome back, ${u.name.split(" ")[0]}` : heading[0];
    $("#page-subtitle").textContent = heading[1];
    $("#welcome-sun").hidden = state.view !== "overview";
    $("#breadcrumb").textContent = state.view[0].toUpperCase() + state.view.slice(1);
    $("#nav-count").textContent = state.data.transactions.length;
    $("#sidebar-name").textContent = u.name;
    $("#sidebar-avatar").textContent = initials;
    $("#top-avatar").textContent = initials;
    $("#month-input").value = state.data.month;
    $("#main-action").textContent =
      state.view === "reports" ? "↓ Export report" : state.view === "budgets" ? "+ Add budget" : "+ Add transaction";
    $("#main-action").setAttribute(
      "aria-label",
      state.view === "reports" ? "Export report" : state.view === "budgets" ? "Add budget" : "Add transaction",
    );
    $("#footer-status").textContent = "All amounts in " + u.currency + " · All changes saved";
    document
      .querySelectorAll("[data-view]")
      .forEach((el) => el.classList.toggle("nav-active", el.dataset.view === state.view));
    $("#page-content").innerHTML =
      state.view === "overview"
        ? summaryCards() +
          chartCards() +
          `<div class="dashboard-grid details-row">${table(true)}${budgetOverview()}</div>`
        : state.view === "transactions"
          ? `<div class="transaction-summary-strip"><span>↙ Money in<strong class="positive-amount">${money(state.data.summary.incomeCents)}</strong></span><span>↗ Money out<strong>${money(state.data.summary.expenseCents)}</strong></span><span>Net cash flow<strong>${money(state.data.summary.incomeCents - state.data.summary.expenseCents)}</strong></span></div>${table()}`
          : state.view === "budgets"
            ? budgetPage()
            : state.view === "reports"
              ? summaryCards() + reportsPage()
              : settingsPage();
    if (state.view === "overview" || state.view === "reports") renderCharts();
    bindView();
  }
  function renderCharts() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Inter Variable', sans-serif";
    Chart.defaults.color = "#8b948e";
    lineChart?.destroy();
    doughnutChart?.destroy();
    let labels, income, expenses;
    if (state.range === "six") {
      labels = state.data.trends.map((t) =>
        new Date(t.month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "short" }),
      );
      income = state.data.trends.map((t) => t.incomeCents);
      expenses = state.data.trends.map((t) => t.expenseCents);
    } else {
      const [year, month] = state.data.month.split("-").map(Number);
      const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
      income = [];
      expenses = [];
      labels = [];
      for (let day = 1; day <= count; day++) {
        const items = state.data.transactions.filter((t) => Number(t.date.slice(-2)) === day);
        income.push(
          (income[day - 2] || 0) + items.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0),
        );
        expenses.push(
          (expenses[day - 2] || 0) + items.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCents, 0),
        );
        labels.push(state.data.month + "/" + String(day).padStart(2, "0"));
      }
    }
    const tooltip = {
      backgroundColor: "#285c43",
      padding: 11,
      cornerRadius: 7,
      callbacks: { label: (item) => " " + money(Number(item.raw)) },
    };
    lineChart = new Chart($("#cash-line"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Income",
            data: income,
            borderColor: "#3b7a57",
            backgroundColor: "rgba(73,130,91,.08)",
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: "Expenses",
            data: expenses,
            borderColor: "#a2b9a2",
            borderDash: [4, 4],
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { maxTicksLimit: 7, maxRotation: 0, font: { size: 10 } },
          },
          y: {
            border: { display: false },
            grid: { color: "#f0f3ef" },
            ticks: {
              font: { size: 10 },
              callback: (value) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: state.data.user.currency,
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value / 100),
            },
          },
        },
      },
    });
    const totals = spendingTotals();
    doughnutChart = new Chart($("#spending-donut"), {
      type: "doughnut",
      data: {
        labels: totals.map((t) => t.category),
        datasets: [
          {
            data: totals.length ? totals.map((t) => t.amount) : [1],
            backgroundColor: totals.length ? totals.map((t) => t.color) : ["#edf1eb"],
            borderWidth: 0,
            borderRadius: 4,
            spacing: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "79%",
        plugins: { legend: { display: false }, tooltip: { ...tooltip, enabled: totals.length > 0 } },
      },
    });
  }
  function bindView() {
    const period = $("#chart-period");
    if (period) period.value = state.range;
    period?.addEventListener("change", (e) => {
      state.range = e.target.value;
      renderCharts();
    });
    $("#category-filter")?.addEventListener("change", (e) => {
      state.category = e.target.value;
      state.page = 1;
      render();
    });
    $("#from-date")?.addEventListener("change", (e) => {
      state.from = e.target.value;
      state.page = 1;
      render();
    });
    $("#to-date")?.addEventListener("change", (e) => {
      state.to = e.target.value;
      state.page = 1;
      render();
    });
    $("#sort-transactions")?.addEventListener("change", (e) => {
      state.sort = e.target.value;
      state.page = 1;
      render();
    });
  }
  function openModal(title, subtitle, html) {
    previousFocus = document.activeElement;
    $("#modal-title").textContent = title;
    $("#modal-subtitle").textContent = subtitle;
    $("#modal-content").innerHTML = html;
    $("#modal-overlay").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#modal-content input")?.focus(), 30);
  }
  function closeModal() {
    if (state.busy) return;
    $("#modal-overlay").hidden = true;
    document.body.style.overflow = "";
    previousFocus?.focus();
  }
  function transactionModal(transaction) {
    const t = transaction || {
      type: "expense",
      amountCents: "",
      description: "",
      category: "Food",
      date: state.data.month === today.slice(0, 7) ? today : state.data.month + "-15",
      account: "Checking account",
    };
    openModal(
      transaction ? "Edit transaction" : "A penny for your thoughts.",
      "Add an income or expense. Every little detail counts.",
      `<form class="app-form" id="transaction-form"><input type="hidden" name="id" value="${transaction?.id || ""}"><input type="hidden" name="type" id="transaction-type" value="${t.type}"><div class="type-switch"><button type="button" aria-label="Expense" class="${t.type === "expense" ? "active" : ""}" data-action="type-expense">↗ Expense</button><button type="button" aria-label="Income" class="${t.type === "income" ? "active" : ""}" data-action="type-income">↙ Income</button></div><label>Amount<div class="amount-input"><span>${state.data.user.currency === "GBP" ? "£" : state.data.user.currency === "EUR" ? "€" : state.data.user.currency === "INR" ? "₹" : "$"}</span><input aria-label="Amount" name="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" value="${t.amountCents ? (t.amountCents / 100).toFixed(2) : ""}" required><small>${state.data.user.currency}</small></div></label><label>Description<input name="description" value="${attr(t.description)}" placeholder="e.g. Weekly groceries" maxlength="120" required></label><div class="form-grid"><label>Category<select aria-label="Category" name="category" id="transaction-category">${(t.type === "income" ? ["Salary"] : categories).map((c) => `<option ${c === t.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Date<input name="date" type="date" value="${t.date}" required></label></div><label>Account<select aria-label="Account" name="account">${["Checking account", "Credit card", "Cash"].map((a) => `<option ${a === t.account ? "selected" : ""}>${a}</option>`).join("")}</select></label><div class="form-error" id="transaction-error" role="alert" hidden></div><div class="form-note">✓ Your balance and budgets update automatically.</div><div class="modal-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">✓ ${transaction ? "Save changes" : "Add transaction"}</button></div></form>`,
    );
  }
  function budgetModal(category) {
    const b = state.data.budgets.find((b) => b.category === category);
    openModal(
      b ? "A little room to adjust." : "Give your money a plan.",
      "Set a monthly limit for " + monthName(state.data.month),
      `<form class="app-form" id="budget-form"><label>Category<select aria-label="Category" name="category">${categories.map((c) => `<option ${c === category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Monthly limit (${state.data.user.currency})<input name="amount" type="number" min="0" max="1000000" step="0.01" placeholder="0.00" value="${b ? (b.amountCents / 100).toFixed(2) : ""}" required></label><div class="budget-form-note"><div><strong>A little plan goes a long way.</strong><p>Set a comfortable limit. You can adjust it anytime. Setting it to 0 removes this limit.</p></div></div><div class="form-error" id="budget-error" role="alert" hidden></div><div class="modal-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">✓ Save budget</button></div></form>`,
    );
  }
  function applyTransaction(transaction, original) {
    const s = { ...state.data.summary };
    const adjust = (t, sign) => {
      if (t.type === "income") {
        s.incomeCents += sign * t.amountCents;
        s.incomeCount += sign;
      } else s.expenseCents += sign * t.amountCents;
      s.balanceCents += sign * (t.type === "income" ? t.amountCents : -t.amountCents);
    };
    if (original) adjust(original, -1);
    adjust(transaction, 1);
    let items = state.data.transactions.filter((t) => t.id !== original?.id && t.id !== transaction.id);
    if (transaction.date.startsWith(state.data.month)) items.push(transaction);
    items.sort((a, b) => b.date.localeCompare(a.date));
    state.data = { ...state.data, transactions: items, summary: s };
  }
  async function deleteItem(kind, id) {
    const item =
      kind === "transaction"
        ? state.data.transactions.find((t) => t.id === id)
        : state.data.budgets.find((b) => b.id === id);
    if (!item) return;
    openModal(
      kind === "transaction" ? "Delete this transaction?" : "Remove this budget?",
      "A quick check before we make a change.",
      `<div class="delete-confirmation"><span class="delete-confirmation-icon">♻</span><strong>${attr(item.description || item.category + " budget")}</strong><p>${kind === "transaction" ? money(item.amountCents) + " · " + item.date : "Only this monthly limit will be removed. Your transactions will stay."}</p><p class="delete-warning">This action can’t be undone.</p></div><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Keep it</button><button class="button button-danger" id="confirm-delete">Yes, delete</button></div>`,
    );
    $("#confirm-delete").addEventListener("click", async () => {
      const button = $("#confirm-delete");
      button.disabled = true;
      button.textContent = "Deleting…";
      try {
        await api(kind === "transaction" ? "/api/transactions/" + id + "/" : "/api/budgets/?id=" + id, "DELETE");
        state.data = await api("/api/dashboard/?month=" + state.data.month);
        render();
        closeModal();
        toast(kind === "transaction" ? "Transaction deleted." : "Budget limit removed.");
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
        button.textContent = "Yes, delete";
      }
    });
  }
  async function exportCSV() {
    try {
      const response = await fetch("/api/export/?month=" + state.data.month, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to export. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "penny-transactions-" + state.data.month + ".csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Your statement is ready. Downloaded as CSV.");
    } catch (error) {
      toast(error.message, true);
    }
  }
  function closePopovers() {
    const notifications = $("#notifications-popover");
    const profile = $("#profile-popover");
    if (notifications) notifications.hidden = true;
    if (profile) profile.hidden = true;
  }
  function notifications() {
    const el = $("#notifications-popover");
    if (!el.hidden) {
      el.hidden = true;
      return;
    }
    closePopovers();
    const alerts = state.data.budgets
      .map((b) => ({
        ...b,
        spent: state.data.transactions
          .filter((t) => t.category === b.category && t.type === "expense")
          .reduce((s, t) => s + t.amountCents, 0),
      }))
      .filter((b) => b.amountCents > 0 && b.spent / b.amountCents >= 0.85);
    el.innerHTML = `<h3>A little heads-up <span>${alerts.length}</span></h3>${alerts.map((b) => `<button class="notification-item" data-action="edit-budget" data-category="${b.category}"><span class="notification-icon">◎</span><span><strong>${b.category} budget check-in</strong><small>You’ve used ${Math.round((b.spent / b.amountCents) * 100)}% of your limit.</small></span></button>`).join("") || '<div class="notifications-empty"><strong>All looking good.</strong><p>No budget alerts right now.</p></div>'}<button class="notification-footer" data-action="budgets">Review your budgets →</button>`;
    el.hidden = false;
  }
  function profileMenu() {
    const el = $("#profile-popover");
    if (!el.hidden) {
      el.hidden = true;
      return;
    }
    closePopovers();
    el.innerHTML = `<div class="profile-popover-heading"><strong>${attr(state.data.user.name)}</strong><small>${attr(state.data.user.email)}</small></div><button data-action="settings">⚙ Account settings</button><button data-action="logout">↪ Sign out</button>`;
    el.hidden = false;
  }
  function help() {
    openModal(
      "A little help to get started.",
      "Better money habits, one small step at a time.",
      `<div class="help-steps"><div><span class="help-step-icon">▤</span><div><h3>Start with the little details</h3><p>Add income and expenses. Your balance updates instantly.</p></div></div><div><span class="help-step-icon">◎</span><div><h3>Give every category a plan</h3><p>Set monthly limits and keep an eye on your progress.</p></div></div><div><span class="help-step-icon">↗</span><div><h3>See the bigger picture</h3><p>Explore your spending breakdown and six-month trends.</p></div></div><div><span class="help-step-icon">✓</span><div><h3>Your data stays yours</h3><p>Your data persists in SQLite. Export it to CSV anytime.</p></div></div></div><div class="modal-actions"><button class="button button-primary" data-action="close-modal">Got it. Let’s go. →</button></div>`,
    );
  }

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest("[data-view]");
    if (nav) {
      event.preventDefault();
      navigate(nav.dataset.view);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) {
      if (!event.target.closest(".popover, #notifications, #profile-button")) closePopovers();
      return;
    }
    const action = button.dataset.action;
    if (action === "add-transaction") transactionModal();
    else if (action === "edit-transaction")
      transactionModal(state.data.transactions.find((t) => t.id === button.dataset.id));
    else if (action === "delete-transaction") deleteItem("transaction", button.dataset.id);
    else if (action === "edit-budget") budgetModal(button.dataset.category);
    else if (action === "delete-budget") deleteItem("budget", button.dataset.id);
    else if (action === "add-budget") budgetModal("Food");
    else if (["overview", "transactions", "budgets", "reports", "settings"].includes(action)) navigate(action);
    else if (action === "close-modal") closeModal();
    else if (action === "export") exportCSV();
    else if (action === "filters") {
      state.showFilters = !state.showFilters;
      render();
    } else if (action === "filter-type") {
      state.type = button.dataset.value;
      state.page = 1;
      render();
    } else if (action === "clear-filters") {
      state.search = "";
      state.type = "all";
      state.category = "all";
      state.from = "";
      state.to = "";
      state.page = 1;
      $("#global-search").value = "";
      render();
    } else if (action === "previous-page") {
      state.page--;
      render();
    } else if (action === "next-page") {
      state.page++;
      render();
    } else if (action === "type-expense" || action === "type-income") {
      const type = action === "type-income" ? "income" : "expense";
      $("#transaction-type").value = type;
      $("#transaction-category").innerHTML = (type === "income" ? ["Salary"] : categories)
        .map((c) => `<option>${c}</option>`)
        .join("");
      document.querySelectorAll(".type-switch button").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
    } else if (action === "change-password") {
      const fields = $("#password-fields");
      fields.hidden = !fields.hidden;
      fields.querySelectorAll("input").forEach((input) => (input.required = !fields.hidden));
    } else if (action === "logout") {
      try {
        await api("/api/auth/", "POST", { action: "logout" });
        window.location.assign("/?view=login");
      } catch (error) {
        toast(error.message, true);
      }
    }
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("form");
    if (!form || !["transaction-form", "budget-form", "profile-form"].includes(form.getAttribute("id"))) return;
    event.preventDefault();
    let previousData = state.data;
    const values = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('[type="submit"]');
    const originalText = submit.textContent;
    state.busy = true;
    submit.disabled = true;
    submit.textContent = "Saving…";
    const error = form.querySelector(".form-error");
    error.hidden = true;
    try {
      if (form.getAttribute("id") === "transaction-form") {
        const original = state.data.transactions.find((t) => t.id === values.id);
        const input = {
          type: values.type,
          description: values.description.trim(),
          amountCents: Math.round(Number(values.amount) * 100),
          category: values.category,
          date: values.date,
          account: values.account,
        };
        const saved = await api(
          original ? "/api/transactions/" + original.id + "/" : "/api/transactions/",
          original ? "PATCH" : "POST",
          input,
        );
        applyTransaction(saved, original);
        render();
        state.data = await api("/api/dashboard/?month=" + saved.date.slice(0, 7));
        render();
        state.busy = false;
        closeModal();
        toast(original ? "Transaction updated." : "Transaction added. Every penny accounted for.");
      } else if (form.getAttribute("id") === "budget-form") {
        const previous = state.data;
        const budget = {
          id: "",
          category: values.category,
          amountCents: Math.round(Number(values.amount) * 100),
          month: state.data.month,
        };
        const others = state.data.budgets.filter((b) => b.category !== budget.category);
        const budgets = budget.amountCents > 0 ? [...others, budget] : others;
        state.data = {
          ...state.data,
          budgets,
          summary: { ...state.data.summary, budgetCents: budgets.reduce((s, b) => s + b.amountCents, 0) },
        };
        render();
        await api("/api/budgets/", "PUT", budget);
        state.data = await api("/api/dashboard/?month=" + state.data.month);
        render();
        state.busy = false;
        closeModal();
        toast(budget.amountCents > 0 ? "Budget saved. A little plan goes a long way." : "Budget limit removed.");
      } else {
        const saved = await api("/api/profile/", "PATCH", values);
        state.data = { ...state.data, user: saved };
        render();
        toast("Your account details have been updated.");
      }
    } catch (e) {
      if (form.getAttribute("id") === "budget-form") {
        state.data = previousData;
        render();
        toast(e.message, true);
      } else {
        error.textContent = e.message;
        error.hidden = false;
      }
    } finally {
      state.busy = false;
      submit.disabled = false;
      submit.textContent = originalText;
    }
  });
  if (state.data) {
    $("#main-action").addEventListener("click", () =>
      state.view === "reports" ? exportCSV() : state.view === "budgets" ? budgetModal("Food") : transactionModal(),
    );
    $("#previous-month").addEventListener("click", () => loadMonth(offsetMonth(-1)));
    $("#next-month").addEventListener("click", () => loadMonth(offsetMonth(1)));
    $("#month-input").addEventListener("change", (e) => loadMonth(e.target.value));
    $("#global-search").addEventListener("input", (e) => {
      state.search = e.target.value;
      $("#clear-search").hidden = !state.search;
      state.page = 1;
      if (state.view !== "transactions") {
        state.view = "transactions";
        history.replaceState({}, "", "/?view=transactions");
      }
      render();
    });
    $("#clear-search").addEventListener("click", () => {
      state.search = "";
      state.page = 1;
      $("#global-search").value = "";
      $("#clear-search").hidden = true;
      render();
      $("#global-search").focus();
    });
    $("#open-sidebar").addEventListener("click", () => $("#sidebar").classList.add("sidebar-open"));
    $("#close-sidebar").addEventListener("click", () => $("#sidebar").classList.remove("sidebar-open"));
    $("#sidebar-profile").addEventListener("click", () => navigate("settings"));
    $("#help-button").addEventListener("click", help);
    $("#close-modal").addEventListener("click", closeModal);
    $("#modal-overlay").addEventListener("click", (e) => {
      if (e.target === $("#modal-overlay")) closeModal();
    });
    $("#notifications").addEventListener("click", notifications);
    $("#profile-button").addEventListener("click", profileMenu);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closePopovers();
        $("#sidebar").classList.remove("sidebar-open");
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        e.preventDefault();
        $("#global-search").focus();
      }
      if (e.key === "Tab" && !$("#modal-overlay").hidden) {
        const elements = [
          ...$("#modal-overlay").querySelectorAll(
            "button:not([disabled]), input:not([disabled]), select:not([disabled])",
          ),
        ].filter((el) => el.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    window.addEventListener("popstate", () => {
      const view = new URLSearchParams(location.search).get("view") || "overview";
      state.view = headings[view] ? view : "overview";
      render();
    });
  }
  document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon, 17)));
  const authForm = $("#auth-form");
  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = authForm.querySelector('[type="submit"]');
      button.disabled = true;
      const values = Object.fromEntries(new FormData(authForm));
      try {
        const result = await api("/api/auth/", "POST", { action: authForm.dataset.mode, ...values });
        if (!result.user) throw new Error("Unable to sign in.");
        window.location.assign("/");
      } catch (error) {
        $("#auth-error").textContent = error.message;
        $("#auth-error").hidden = false;
        button.disabled = false;
      }
    });
    $("#demo-button").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await api("/api/auth/", "POST", { action: "demo" });
        window.location.assign("/");
      } catch (error) {
        $("#auth-error").textContent = error.message;
        $("#auth-error").hidden = false;
        e.target.disabled = false;
      }
    });
  } else render();
})();
