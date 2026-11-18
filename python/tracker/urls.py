from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .api import SessionAPI, DashboardAPI, TransactionViewSet, BudgetAPI, ProfileAPI, ExportAPI, HealthAPI
router = DefaultRouter()
router.register("transactions", TransactionViewSet, basename="transaction")
urlpatterns = [path("", views.dashboard, name="dashboard"), path("api/auth/", SessionAPI.as_view()), path("api/dashboard/", DashboardAPI.as_view()), path("api/", include(router.urls)), path("api/budgets/", BudgetAPI.as_view()), path("api/profile/", ProfileAPI.as_view()), path("api/export/", ExportAPI.as_view()), path("api/health/", HealthAPI.as_view())]
