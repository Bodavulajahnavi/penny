from django.contrib.auth import login
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

from .seed import seed_demo
from .services import current_month, get_dashboard, valid_month

VIEWS = ("overview", "transactions", "budgets", "reports", "settings")


@ensure_csrf_cookie
def dashboard(request):
    view = request.GET.get("view", "overview")
    if view in ("login", "signup"):
        return render(request, "auth.html", {"mode": view})
    user = request.user
    if not user.is_authenticated:
        # First visit: open the seeded demo workspace so the app feels alive immediately.
        user = seed_demo()
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    elif user.is_demo:
        user = seed_demo()  # refreshes the shared demo's sample data once per day
    month = request.GET.get("month") or current_month()
    if not valid_month(month):
        month = current_month()
    return render(
        request,
        "dashboard.html",
        {"initial_view": view if view in VIEWS else "overview", "month": month, "initial_data": get_dashboard(user, month)},
    )
