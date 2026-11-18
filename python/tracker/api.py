import csv
from datetime import date
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.http import HttpResponse
from django.db import connection
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Transaction, Budget
from .serializers import UserSerializer, SignupSerializer, TransactionSerializer, BudgetSerializer
from .seed import seed_demo
from .services import get_dashboard, valid_month, current_month


def safe_text(value):
    """Neutralize text that spreadsheet apps would evaluate as a formula."""
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


def month_filter(month):
    year, number = map(int, month.split("-"))
    return {"date__year": year, "date__month": number}


class SessionAPI(APIView):
    permission_classes = [AllowAny]
    renderer_classes = [JSONRenderer]

    def get(self, request):
        return Response({"user": UserSerializer(request.user).data if request.user and request.user.is_authenticated else None})

    def post(self, request):
        data = request.data
        action = data.get("action")
        if action == "logout":
            logout(request)
            return Response({"ok": True})
        if action == "demo":
            user = seed_demo()
            login(request, user)
            return Response({"user": UserSerializer(user).data})
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if action == "signup":
            serializer = SignupSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            try:
                validate_password(password)
            except DjangoValidationError as error:
                return Response({"non_field_errors": error.messages}, status=400)
            if len(password.encode()) > 128:
                return Response({"non_field_errors": ["Use a password of up to 128 bytes."]}, status=400)
            user = serializer.save()
        elif action == "login":
            user = authenticate(request, username=email, password=password)
            if not user or not user.is_active or len(password.encode()) > 128:
                return Response({"non_field_errors": ["The email or password is incorrect."]}, status=401)
        else:
            return Response({"non_field_errors": ["Unknown authentication action."]}, status=400)
        login(request, user)
        return Response({"user": UserSerializer(user).data}, status=201 if action == "signup" else 200)


class DashboardAPI(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(get_dashboard(request.user, request.GET.get("month") or current_month()))


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]
    def get_queryset(self):
        queryset = Transaction.objects.filter(user=self.request.user).order_by("-date", "-created_at")
        params = self.request.GET
        month = params.get("month")
        if month and not valid_month(month):
            raise ValidationError({"month": "Choose a valid month in YYYY-MM format."})
        if month:
            queryset = queryset.filter(**month_filter(month))
        if params.get("category"):
            queryset = queryset.filter(category=params["category"])
        if params.get("type"):
            queryset = queryset.filter(type=params["type"])
        if params.get("search"):
            queryset = queryset.filter(Q(description__icontains=params["search"]) | Q(category__icontains=params["search"]))
        for param, lookup in (("from_date", "date__gte"), ("to_date", "date__lte")):
            if params.get(param):
                try:
                    queryset = queryset.filter(**{lookup: date.fromisoformat(params[param])})
                except ValueError:
                    raise ValidationError({param: "Use a date in YYYY-MM-DD format."})
        return queryset
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BudgetAPI(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]
    def put(self, request):
        serializer = BudgetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["amount_cents"] == 0:
            # A zero limit means "no budget" for this category and month.
            Budget.objects.filter(user=request.user, category=data["category"], month=data["month"]).delete()
            return Response({"removed": True, "category": data["category"], "month": data["month"]})
        budget, _ = Budget.objects.update_or_create(user=request.user, category=data["category"], month=data["month"], defaults={"amount_cents": data["amount_cents"]})
        return Response(BudgetSerializer(budget).data)
    def delete(self, request):
        try:
            budget = Budget.objects.get(pk=request.GET.get("id"), user=request.user)
        except (Budget.DoesNotExist, DjangoValidationError, ValueError, TypeError):
            return Response(status=404)
        budget.delete()
        return Response(status=204)


class ProfileAPI(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]
    def patch(self, request):
        serializer = UserSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        new_password = data.pop("new_password", "")
        current_password = data.pop("current_password", "")
        email_changed = "email" in data and data["email"].strip().lower() != request.user.email.lower()
        if request.user.is_demo and (email_changed or new_password):
            # The demo login is shared by every visitor, so its credentials stay fixed.
            return Response({"non_field_errors": ["The shared demo account’s email and password can’t be changed. Create your own account to try this."]}, status=400)
        if new_password:
            if not current_password or not request.user.check_password(current_password):
                return Response({"non_field_errors": ["Your current password is incorrect."]}, status=400)
            try:
                validate_password(new_password, request.user)
            except DjangoValidationError as error:
                return Response({"non_field_errors": error.messages}, status=400)
            if len(new_password.encode()) > 128:
                return Response({"non_field_errors": ["Use a password of up to 128 bytes."]}, status=400)
        if "display_name" in data:
            request.user.display_name = data.pop("display_name")
        for key, value in data.items():
            setattr(request.user, key, value)
        if new_password:
            request.user.set_password(new_password)
        request.user.save()
        update_session_auth_hash(request, request.user)
        return Response(UserSerializer(request.user).data)


class ExportAPI(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        month = request.GET.get("month") or current_month()
        if not valid_month(month):
            return Response({"detail": "Choose a valid month."}, status=400)
        items = Transaction.objects.filter(user=request.user, **month_filter(month)).order_by("-date", "-created_at")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="penny-transactions-{month}.csv"'
        response.write("\ufeff")  # BOM so spreadsheet apps detect UTF-8
        writer = csv.writer(response)
        writer.writerow(["Date", "Description", "Type", "Category", "Amount", "Currency", "Account"])
        for item in items:
            # Amounts stay numeric; only free text is protected against formula injection.
            amount = (-item.amount_cents if item.type == "expense" else item.amount_cents) / 100
            writer.writerow([item.date.isoformat(), safe_text(item.description), item.type, item.category, f"{amount:.2f}", request.user.currency, safe_text(item.account)])
        return response


class HealthAPI(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"ok": True})
