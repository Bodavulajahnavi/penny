from datetime import date

from django.db import transaction
from django.utils import timezone

from .models import Budget, Transaction, User
from .services import current_month, month_offset

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"

HISTORY = [
    ("Rent", 95000, "Monthly rent"),
    ("Food", 110000, "Groceries & dining"),
    ("Transport", 40000, "Getting around"),
    ("Entertainment", 70000, "Entertainment & subscriptions"),
]
THIS_MONTH = [
    ("Grocery run", 6450, "Food", 0, "Checking account"),
    ("Spotify Premium", 1099, "Entertainment", 1, "Credit card"),
    ("Dinner with friends", 4800, "Food", 2, "Checking account"),
    ("Metro top-up", 5000, "Transport", 3, "Checking account"),
    ("Weekly groceries", 8235, "Food", 4, "Checking account"),
    ("Cinema night", 3200, "Entertainment", 5, "Credit card"),
    ("Coffee & a little treat", 1250, "Food", 6, "Cash"),
    ("Uber ride", 2800, "Transport", 7, "Credit card"),
    ("Lunch on campus", 4275, "Food", 8, "Checking account"),
    ("Fresh groceries", 6785, "Food", 9, "Checking account"),
    ("Bus pass", 2500, "Transport", 10, "Checking account"),
    ("Weekly groceries", 12500, "Food", 11, "Checking account"),
    ("Live music", 7701, "Entertainment", 12, "Credit card"),
    ("Coffee with friends", 1850, "Food", 13, "Cash"),
    ("Train ticket", 2500, "Transport", 14, "Checking account"),
    ("Dinner out", 2500, "Food", 15, "Credit card"),
]
LIMITS = [("Food", 55000), ("Rent", 100000), ("Transport", 20000), ("Entertainment", 25000), ("Shopping", 20000)]


def _sample_transactions(user):
    month = current_month()
    day = date.today().day

    def month_day(value):
        return f"{month}-{value:02d}"

    def date_at(days_ago):
        # Spread this month's transactions across the days elapsed so far, so they never clump on day 1.
        spread = days_ago if day > 15 else int(days_ago * (day - 1) / 15 + 0.5)
        return month_day(day - spread)

    rows = []
    for index in range(5):  # five complete months of history for the six-month trend
        history_month = month_offset(month, index - 5)
        rows.append(Transaction(user=user, type="income", description="Monthly salary", amount_cents=420000, category="Salary", date=f"{history_month}-01"))
        for position, (category, amount, description) in enumerate(HISTORY):
            if category == "Entertainment":
                amount += index * 2500
            rows.append(Transaction(user=user, type="expense", description=description, amount_cents=amount, category=category, date=f"{history_month}-{3 + position * 5:02d}"))
    # This month, day by day — never dated in the future.
    rows.append(Transaction(user=user, type="income", description="Monthly salary", amount_cents=420000, category="Salary", date=month_day(1)))
    rows.append(Transaction(user=user, type="income", description="Freelance project", amount_cents=65000, category="Salary", date=date_at(3)))
    rows.append(Transaction(user=user, type="expense", description="Monthly rent", amount_cents=95000, category="Rent", date=month_day(min(2, day))))
    for description, amount, category, days_ago, account in THIS_MONTH:
        rows.append(Transaction(user=user, type="expense", description=description, amount_cents=amount, category=category, date=date_at(days_ago), account=account))
    return rows


def seed_demo(password=DEMO_PASSWORD):
    """Return the shared demo account.

    Its sample data is rebuilt once per day (UTC), relative to today, so the workspace always shows a
    lively current month and visitors' experiments are tidied up. The account ID never changes and the
    password hash is kept, so existing demo sessions stay valid.
    """
    with transaction.atomic():
        now = timezone.now()
        user = User.objects.filter(email=DEMO_EMAIL).first()
        if user and user.date_joined.date() == now.date():
            return user
        if user is None:
            user = User(email=DEMO_EMAIL)
        user.display_name = "Alex Morgan"
        user.currency = "USD"
        user.is_demo = True
        user.date_joined = now  # doubles as "sample data generated at"
        if not user.has_usable_password() or not user.check_password(password):
            user.set_password(password)
        user.save()
        user.transactions.all().delete()
        user.budgets.all().delete()
        Transaction.objects.bulk_create(_sample_transactions(user))
        month = current_month()
        Budget.objects.bulk_create(
            [Budget(user=user, category=category, month=month_offset(month, -index), amount_cents=amount) for index in range(6) for category, amount in LIMITS]
        )
        return user
