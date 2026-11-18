from datetime import date
from calendar import monthrange
from collections import defaultdict
from rest_framework.exceptions import ValidationError


def current_month():
    return date.today().strftime("%Y-%m")


def valid_month(value):
    if not isinstance(value, str) or len(value) != 7 or value[4] != "-":
        return False
    try:
        date.fromisoformat(value + "-01")
        return value.startswith("20") and value[5:7] in {f"{i:02d}" for i in range(1, 13)}
    except ValueError:
        return False


def month_offset(month, offset):
    year, number = map(int, month.split("-"))
    index = year * 12 + number - 1 + offset
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def transaction_data(transaction):
    return {"id": str(transaction.pk), "type": transaction.type, "description": transaction.description, "amountCents": transaction.amount_cents, "category": transaction.category, "date": transaction.date.isoformat(), "account": transaction.account, "createdAt": transaction.created_at.isoformat() if transaction.created_at else None}


def budget_data(budget):
    return {"id": str(budget.pk), "category": budget.category, "amountCents": budget.amount_cents, "month": budget.month}


def user_data(user):
    return {"id": str(user.pk), "name": user.display_name, "email": user.email, "currency": user.currency, "isDemo": int(user.is_demo), "createdAt": user.date_joined.isoformat()}


def get_dashboard(user, month=None):
    month = month or current_month()
    if not valid_month(month):
        raise ValidationError("Choose a valid month in YYYY-MM format.")
    transactions = list(user.transactions.all().order_by("-date", "-created_at"))
    current = [t for t in transactions if t.date.strftime("%Y-%m") == month]
    previous = [t for t in transactions if t.date.strftime("%Y-%m") == month_offset(month, -1)]
    budgets = list(user.budgets.filter(month=month))
    income = sum(t.amount_cents for t in current if t.type == "income")
    expenses = sum(t.amount_cents for t in current if t.type == "expense")
    previous_income = sum(t.amount_cents for t in previous if t.type == "income")
    previous_expenses = sum(t.amount_cents for t in previous if t.type == "expense")
    balance = sum(t.amount_cents if t.type == "income" else -t.amount_cents for t in transactions if t.date.strftime("%Y-%m") <= month)
    trends = []
    for i in range(6):
        m = month_offset(month, i - 5)
        items = [t for t in transactions if t.date.strftime("%Y-%m") == m]
        trends.append({"month": m, "incomeCents": sum(t.amount_cents for t in items if t.type == "income"), "expenseCents": sum(t.amount_cents for t in items if t.type == "expense")})
    return {"user": user_data(user), "month": month, "transactions": [transaction_data(t) for t in current], "budgets": [budget_data(b) for b in budgets], "trends": trends, "summary": {"balanceCents": balance, "incomeCents": income, "expenseCents": expenses, "previousIncomeCents": previous_income, "previousExpenseCents": previous_expenses, "budgetCents": sum(b.amount_cents for b in budgets), "incomeCount": sum(t.type == "income" for t in current)}}
