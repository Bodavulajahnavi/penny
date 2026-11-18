import { chromium, expect } from "@playwright/test";
import http from "node:http";
import assert from "node:assert/strict";

const python = process.argv.includes("--python");
const base =
  process.env.APP_URL || (python ? process.env.PYTHON_URL || "http://localhost:8000" : "http://localhost:3000");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// Expected 4xx responses (e.g. a wrong password) log 'Failed to load resource'; anything else fails the run.
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().startsWith("Failed to load resource"))
    errors.push(`console: ${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
});
const data = (month = new Date().toISOString().slice(0, 7)) =>
  page.evaluate(
    async ({ path, month }) => (await fetch(path + "?month=" + month, { credentials: "same-origin" })).json(),
    { path: python ? "/api/dashboard/" : "/api/dashboard", month },
  );
const nav = (label, target = page) =>
  python
    ? target.locator(`.main-nav a[data-view="${label.toLowerCase()}"]`).click()
    : target.locator(".main-nav button").filter({ hasText: label }).click();
const dialog = () => page.getByRole("dialog");
const save = () =>
  dialog()
    .getByRole("button", { name: /Save changes|Add transaction|Save budget/ })
    .click();
const waitSaved = async () => {
  await expect(dialog()).toBeHidden({ timeout: 15000 });
  await page.waitForTimeout(250);
};
const log = (text) => console.log(`✓ ${text}`);

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 15000 });
  await expect(page.locator("h1")).toContainText("Welcome back, Alex");
  await expect(page.locator("canvas")).toHaveCount(2, { timeout: 15000 });
  await page.waitForTimeout(700);
  let initial = await data();
  assert.equal(initial.summary.incomeCents, 485000);
  assert.equal(initial.summary.expenseCents, 168445);
  assert.equal(initial.summary.balanceCents, 816555);
  assert.equal(initial.transactions.length, 19);
  const desktop = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    sidebar: document.querySelector(".sidebar").getBoundingClientRect().width,
    heading: getComputedStyle(document.querySelector("h1")).fontSize,
    transactionFont: getComputedStyle(document.querySelector(".transaction-description strong")).fontSize,
    chartWidth: document.querySelector(".cashflow-card").getBoundingClientRect().width,
    spendingWidth: document.querySelector(".spending-card").getBoundingClientRect().width,
  }));
  assert.ok(desktop.scrollWidth <= desktop.width, JSON.stringify(desktop));
  await page.screenshot({ path: python ? "/tmp/penny-django-desktop.png" : "/tmp/penny-desktop.png", fullPage: true });
  console.log("Desktop layout:", JSON.stringify(desktop));
  log("Populated dashboard, charts, summary totals, and desktop layout");

  const today = new Date().toISOString().slice(0, 10);
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await dialog().getByRole("spinbutton", { name: "Amount", exact: true }).fill("12.50");
  await dialog().getByLabel("Description", { exact: true }).fill("Browser test lunch");
  await dialog().getByLabel("Category", { exact: true }).selectOption("Food");
  await dialog().getByLabel("Date", { exact: true }).fill(today);
  await dialog().getByLabel("Account", { exact: true }).selectOption("Cash");
  await save();
  await waitSaved();
  let current = await data();
  let transaction = current.transactions.find((t) => t.description === "Browser test lunch");
  assert.ok(transaction);
  assert.equal(transaction.amountCents, 1250);
  assert.equal(current.summary.expenseCents, initial.summary.expenseCents + 1250);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Edit Browser test lunch", exact: true }).click();
  await dialog().getByRole("spinbutton", { name: "Amount", exact: true }).fill("18.25");
  await save();
  await waitSaved();
  assert.equal((await data()).transactions.find((t) => t.id === transaction.id).amountCents, 1825);
  await page.getByRole("button", { name: "Delete Browser test lunch", exact: true }).click();
  await dialog().getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(dialog()).toBeHidden({ timeout: 15000 });
  assert.ok(!(await data()).transactions.some((t) => t.id === transaction.id));
  log("Expense create, edit, delete, and reload persistence");

  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await dialog().getByRole("button", { name: "Income", exact: true }).click();
  await dialog().getByRole("spinbutton", { name: "Amount", exact: true }).fill("100");
  await dialog().getByLabel("Description", { exact: true }).fill("Browser test freelance");
  await dialog().getByLabel("Date", { exact: true }).fill(today);
  await save();
  await waitSaved();
  assert.equal((await data()).summary.incomeCents, initial.summary.incomeCents + 10000);
  await page.getByRole("button", { name: "Delete Browser test freelance", exact: true }).click();
  await dialog().getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(dialog()).toBeHidden({ timeout: 15000 });
  log("Income creation and automatic balance updates");

  const foodBudget = initial.budgets.find((b) => b.category === "Food");
  await page.locator(".budget-row").filter({ hasText: "Food" }).click();
  await dialog()
    .getByLabel(/Monthly limit/)
    .fill(((foodBudget.amountCents + 1000) / 100).toFixed(2));
  await save();
  await waitSaved();
  assert.equal((await data()).budgets.find((b) => b.category === "Food").amountCents, foodBudget.amountCents + 1000);
  await page.locator(".budget-row").filter({ hasText: "Food" }).click();
  await dialog()
    .getByLabel(/Monthly limit/)
    .fill((foodBudget.amountCents / 100).toFixed(2));
  await save();
  await waitSaved();
  log("Budget editing and persistent monthly limits");

  await page.getByRole("textbox", { name: "Search transactions", exact: true }).fill("Spotify");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Spotify Premium");
  await page.locator(".global-search").getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByLabel("Filter by category", { exact: true }).selectOption("Food");
  assert.ok((await page.locator("tbody tr").count()) > 0);
  await page.locator(".transaction-tabs").getByRole("button", { name: "Income", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching transactions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("From date", { exact: true }).fill(`${initial.month}-01`);
  await page.getByLabel("To date", { exact: true }).fill(today);
  assert.ok((await page.locator("tbody tr").count()) >= 1);
  await page.locator(".advanced-filters").getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".pagination")).toContainText("Page 2");
  log("Search, category/type/date filters, empty states, and pagination");

  await nav("Overview");
  await page.getByRole("button", { name: "Previous month", exact: true }).click();
  const previousMonth = new Date(Date.UTC(Number(initial.month.slice(0, 4)), Number(initial.month.slice(5)) - 2, 1))
    .toISOString()
    .slice(0, 7);
  const initialMonthLabel = new Date(initial.month + "-01T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  await expect(page.locator(".month-current")).not.toContainText(initialMonthLabel, { timeout: 15000 });
  await expect.poll(async () => (await data(previousMonth)).month, { timeout: 15000 }).toBe(previousMonth);
  let previous = await data(previousMonth);
  assert.notEqual(previous.month, initial.month);
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect.poll(async () => (await data(initial.month)).month, { timeout: 15000 }).toBe(initial.month);
  assert.equal((await data(initial.month)).month, initial.month);
  await page.getByLabel("Cash flow period", { exact: true }).selectOption("six");
  await page.waitForTimeout(300);
  log("Month navigation and six-month chart trends");

  await nav("Reports");
  await expect(page.locator("h1")).toContainText("Your money, in perspective.");
  await expect(page.locator("canvas")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report", exact: true }).click();
  assert.match((await download).suggestedFilename(), /\.csv$/);
  await nav("Budgets");
  await expect(page.locator(".category-budget-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Add budget", exact: true }).click();
  await dialog().getByLabel("Category", { exact: true }).selectOption("Other");
  await dialog()
    .getByLabel(/Monthly limit/)
    .fill("50");
  await save();
  await waitSaved();
  assert.equal((await data()).budgets.find((b) => b.category === "Other").amountCents, 5000);
  await page.getByRole("button", { name: "Remove Other budget", exact: true }).click();
  await dialog().getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(dialog()).toBeHidden({ timeout: 15000 });
  assert.ok(!(await data()).budgets.some((b) => b.category === "Other"));
  log("Reports, CSV download, and budget creation/deletion");

  await nav("Settings");
  await page.getByLabel("Full name", { exact: true }).fill("Alex Budgeter");
  await page.getByRole("button", { name: /Save changes/ }).click();
  await expect(page.locator(".settings-profile")).toContainText("Alex Budgeter");
  assert.equal((await data()).user.name, "Alex Budgeter");
  await page.getByLabel("Full name", { exact: true }).fill("Alex Morgan");
  await page.getByRole("button", { name: /Save changes/ }).click();
  await expect.poll(async () => (await data()).user.name, { timeout: 15000 }).toBe("Alex Morgan");
  // The shared demo login is protected, so it keeps working for every visitor.
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByLabel("Current password", { exact: true }).fill("demo1234");
  await page.getByLabel("New password", { exact: true }).fill("testpass1234");
  await page.getByRole("button", { name: /Save changes/ }).click();
  await expect(page.locator(".form-error").filter({ hasText: /demo/i })).toBeVisible();
  await page.getByRole("button", { name: "Sign out of penny", exact: true }).click();
  await page.waitForURL("**/?view=login");
  await page.getByLabel("Email address", { exact: true }).fill("demo@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrongpassword");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".form-error")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 15000 });
  log("Profile editing, protected demo credentials, logout, and login validation");

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(base, { waitUntil: "networkidle" });
  await expect(mobile.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 15000 });
  await mobile.waitForTimeout(500);
  const mobileSize = await mobile.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(mobileSize.scrollWidth <= mobileSize.width, JSON.stringify(mobileSize));
  await mobile.screenshot({ path: python ? "/tmp/penny-django-mobile.png" : "/tmp/penny-mobile.png", fullPage: true });
  await mobile.getByRole("button", { name: "Open navigation", exact: true }).click();
  await nav("Transactions", mobile);
  await expect(mobile.locator("h1")).toContainText("Your transactions");
  await mobile.getByRole("button", { name: "Add transaction", exact: true }).click();
  const modalSize = await mobile.getByRole("dialog").boundingBox();
  assert.ok(modalSize.width <= 390);
  await mobile.getByRole("button", { name: "Cancel", exact: true }).click();
  await mobile.close();
  log("Responsive mobile dashboard, sidebar navigation, and dialogs");

  await nav("Settings");
  await page.getByRole("button", { name: "Sign out of penny", exact: true }).click();
  await page.waitForURL("**/?view=login");
  await page.getByRole("link", { name: /Create an account/ }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Jamie Test");
  const email = `jamie-${Date.now()}@example.com`;
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("testpass1234");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 15000 });
  const fresh = await data();
  assert.equal(fresh.user.email, email);
  assert.equal(fresh.transactions.length, 0);
  assert.equal(fresh.summary.balanceCents, 0);
  await expect(page.getByRole("heading", { name: "A fresh start for your finances", exact: true })).toBeVisible();
  await nav("Settings");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByLabel("Current password", { exact: true }).fill("testpass1234");
  await page.getByLabel("New password", { exact: true }).fill("freshpass5678");
  await page.getByRole("button", { name: /Save changes/ }).click();
  await expect(page.locator(".toast").filter({ hasText: /updated/i })).toBeVisible();
  await page.getByRole("button", { name: "Sign out of penny", exact: true }).click();
  await page.waitForURL("**/?view=login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("freshpass5678");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 15000 });
  assert.equal((await data()).user.email, email);
  log("Sign-up, isolated new account, empty state, and personal password change");

  if (!python) {
    // Preview panes embed the app in a cross-site iframe (here: a 127.0.0.1 page framing localhost).
    const parentServer = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        `<!doctype html><title>Preview pane</title><iframe title="penny preview" src="${base}/" style="width:1400px;height:950px;border:0"></iframe>`,
      );
    });
    await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
    const embedded = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const host = await embedded.newPage();
    host.on("pageerror", (error) => errors.push(`embedded: ${error.message}`));
    host.on("console", (message) => {
      if (message.type() === "error") errors.push(`embedded console: ${message.text()}`);
    });
    try {
      await host.goto(`http://127.0.0.1:${parentServer.address().port}/`, { waitUntil: "networkidle" });
      const frame = host.frameLocator('iframe[title="penny preview"]');
      await expect(frame.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 20000 });
      await expect(frame.locator(".toast-error")).toHaveCount(0);
      await frame.getByRole("button", { name: "Add transaction", exact: true }).click();
      const embeddedDialog = frame.getByRole("dialog");
      await embeddedDialog.getByRole("spinbutton", { name: "Amount", exact: true }).fill("9.99");
      await embeddedDialog.getByLabel("Description", { exact: true }).fill("Embedded preview coffee");
      await embeddedDialog.getByRole("button", { name: /Add transaction/ }).click();
      await expect(embeddedDialog).toBeHidden({ timeout: 15000 });
      await expect(frame.locator("tbody")).toContainText("Embedded preview coffee");
      await host.reload({ waitUntil: "networkidle" });
      await expect(frame.getByRole("button", { name: "Add transaction", exact: true })).toBeEnabled({ timeout: 20000 });
      await frame.getByRole("button", { name: "Delete Embedded preview coffee", exact: true }).click();
      await frame.getByRole("dialog").getByRole("button", { name: "Yes, delete", exact: true }).click();
      await expect(frame.getByRole("dialog")).toBeHidden({ timeout: 15000 });
      await expect(frame.locator("tbody")).not.toContainText("Embedded preview coffee");
    } finally {
      await embedded.close();
      parentServer.close();
    }
    log("Embedded cross-site preview pane: session, create, reload, and delete");
  }

  assert.deepEqual(errors, []);
  console.log(`\nAll ${python ? "Django" : "Next.js"} browser smoke tests passed.`);
} catch (error) {
  await page.screenshot({ path: "/tmp/penny-test-failure.png", fullPage: true }).catch(() => {});
  console.error("Browser errors:", errors);
  console.error("Current URL:", page.url());
  console.error("Visible error:", await page.locator(".form-error").allTextContents());
  throw error;
} finally {
  await browser.close();
}
