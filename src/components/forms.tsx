"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ShieldCheck,
  LockKeyhole,
  Download,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  money,
  today,
  type Transaction,
  type TransactionType,
  type Category,
  type UserProfile,
} from "@/lib/finance";
export interface TransactionInput {
  type: TransactionType;
  description: string;
  amountCents: number;
  category: Category;
  date: string;
  account: string;
}
export function TransactionForm({
  initial,
  defaultType = "expense",
  month,
  currency,
  onSubmit,
  onCancel,
}: {
  initial?: Transaction;
  defaultType?: TransactionType;
  month: string;
  currency: string;
  onSubmit: (input: TransactionInput, id?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type || defaultType);
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState<Category>(
    initial?.category || (defaultType === "income" ? "Salary" : "Food"),
  );
  const [date, setDate] = useState(initial?.date || (month === today().slice(0, 7) ? today() : `${month}-15`));
  const [account, setAccount] = useState(initial?.account || "Checking account");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100000000) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setPending(true);
    try {
      await onSubmit(
        {
          type,
          description: description.trim(),
          amountCents,
          category: type === "income" ? "Salary" : category,
          date,
          account,
        },
        initial?.id,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="app-form">
      <div className="type-switch">
        <button
          type="button"
          className={type === "expense" ? "active" : ""}
          onClick={() => {
            setType("expense");
            setCategory("Food");
          }}
        >
          <ArrowUpRight size={17} />
          Expense
        </button>
        <button
          type="button"
          className={type === "income" ? "active income-tab" : ""}
          onClick={() => {
            setType("income");
            setCategory("Salary");
          }}
        >
          <ArrowDownLeft size={17} />
          Income
        </button>
      </div>
      <label className="amount-field">
        Amount <span className="required-mark">*</span>
        <div className="amount-input">
          <span>{currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "INR" ? "₹" : "$"}</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            min="0.01"
            max="1000000"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            aria-label="Amount"
          />
          <small>{currency}</small>
        </div>
      </label>
      <label>
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "expense" ? "e.g. Weekly groceries" : "e.g. Monthly salary"}
          maxLength={120}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Category
          <div className="form-select">
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {(type === "income" ? ["Salary"] : EXPENSE_CATEGORIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <label>
        Account
        <div className="form-select">
          <select aria-label="Account" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option>Checking account</option>
            <option>Credit card</option>
            <option>Cash</option>
          </select>
          <ChevronDown size={15} />
        </div>
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-note">
        <ShieldCheck size={15} />
        Your balance and budgets update automatically.
      </div>
      <div className="modal-actions">
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
          {pending ? "Saving…" : initial ? "Save changes" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}
export function BudgetForm({
  initial,
  defaultCategory,
  categories,
  month,
  currency,
  onSubmit,
  onCancel,
}: {
  initial?: { id?: string; category: Category; amountCents: number };
  defaultCategory?: Category;
  categories: Category[];
  month: string;
  currency: string;
  onSubmit: (category: Category, amountCents: number, id?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<Category>(initial?.category || defaultCategory || categories[0] || "Food");
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await onSubmit(category, Math.round(Number(amount) * 100), initial?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save budget.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="app-form" onSubmit={submit}>
      <label>
        Category
        <div className="form-select">
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
      </label>
      <label>
        Monthly limit ({currency})
        <input
          type="number"
          min="0"
          step="0.01"
          max="1000000"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <div className="budget-form-note">
        <ShieldCheck size={21} />
        <div>
          <strong>A little plan goes a long way.</strong>
          <p>
            Set a comfortable limit for {category.toLowerCase()}. You can adjust it anytime. Setting it to 0 removes
            this limit.
          </p>
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="button button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
          {pending ? "Saving…" : "Save budget"}
        </button>
      </div>
    </form>
  );
}
export function ProfileSettings({
  user,
  onSave,
  onLogout,
  onExport,
}: {
  user: UserProfile;
  onSave: (input: Record<string, string>) => Promise<void>;
  onLogout: () => void;
  onExport: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currency, setCurrency] = useState(user.currency);
  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setSuccess(false);
    try {
      await onSave({ name, email, currency, ...(changePassword ? { currentPassword, newPassword } : {}) });
      setSuccess(true);
      setChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update account.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="card settings-card">
        <div className="card-heading">
          <div>
            <h2>Account details</h2>
            <p>Make this little space your own</p>
          </div>
        </div>
        <div className="settings-profile">
          <span className="avatar avatar-large">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.isDemo ? "Demo account" : "Personal account"}</span>
          </div>
        </div>
        <form className="app-form" onSubmit={submit}>
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required />
          </label>
          <label>
            Email address
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
          </label>
          <label>
            Display currency
            <div className="form-select">
              <select aria-label="Display currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="INR">INR — Indian Rupee</option>
              </select>
              <ChevronDown size={15} />
            </div>
          </label>
          <p className="field-note">Changes the display symbol only; amounts are not converted.</p>
          {changePassword && (
            <div className="password-fields">
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </label>
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="form-success" role="status">
              <Check size={15} />
              Your account details are up to date.
            </div>
          )}
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
      <div className="settings-side">
        <section className="card settings-card">
          <div className="card-heading">
            <div>
              <h2>Password & security</h2>
              <p>A little extra peace of mind</p>
            </div>
            <LockKeyhole size={20} />
          </div>
          <div className="security-content">
            <p>Your password is securely hashed. Your session keeps you signed in on this device.</p>
            <button className="button button-secondary" onClick={() => setChangePassword(!changePassword)}>
              {changePassword ? "Cancel password change" : "Change password"}
            </button>
          </div>
        </section>
        <section className="card settings-card">
          <div className="card-heading">
            <div>
              <h2>Your data, your way</h2>
              <p>Take your transactions with you</p>
            </div>
            <Download size={20} />
          </div>
          <div className="security-content">
            <p>Download this month’s transactions as a CSV, ready for your spreadsheet.</p>
            <button className="button button-secondary" onClick={onExport}>
              Export transactions
            </button>
          </div>
        </section>
        {user.isDemo === 1 && (
          <div className="demo-account-note">
            <ShieldCheck size={20} />
            <p>
              You’re exploring the shared demo — try anything you like. Its email and password stay fixed so everyone
              can sign in; create your own account for a fresh start.
            </p>
          </div>
        )}
        <button className="logout-button" onClick={onLogout}>
          Sign out of penny
        </button>
      </div>
    </div>
  );
}
