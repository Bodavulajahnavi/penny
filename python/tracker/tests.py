from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Transaction
from .seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo
from .services import current_month, get_dashboard

User = get_user_model()


class FinanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = seed_demo()

    def test_demo_is_idempotent_and_realistic(self):
        self.assertEqual(User.objects.filter(email=DEMO_EMAIL).count(), 1)
        self.assertEqual(self.user.transactions.count(), 44)
        self.assertEqual(self.user.budgets.count(), 30)
        data = get_dashboard(self.user)
        self.assertEqual(data["summary"]["incomeCents"], 485000)
        self.assertEqual(data["summary"]["expenseCents"], 168445)
        self.assertEqual(data["summary"]["balanceCents"], 816555)
        self.assertEqual(len(data["trends"]), 6)
        self.assertTrue(self.user.check_password(DEMO_PASSWORD))
        self.assertFalse(self.user.transactions.filter(date__gt=date.today()).exists())
        seed_demo()
        self.assertEqual(self.user.transactions.count(), 44)

    def test_login_logout_and_current_user(self):
        response = self.client.post("/api/auth/", {"action": "login", "email": DEMO_EMAIL, "password": DEMO_PASSWORD}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/").json()["user"]["email"], DEMO_EMAIL)
        self.client.post("/api/auth/", {"action": "logout"}, format="json")
        self.assertIsNone(self.client.get("/api/auth/").json()["user"])

    def test_signup_and_new_account_empty_state(self):
        response = self.client.post(
            "/api/auth/", {"action": "signup", "name": "Jamie Student", "email": "jamie@example.com", "password": "study1234"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        dashboard = self.client.get("/api/dashboard/").json()
        self.assertEqual(dashboard["transactions"], [])
        self.assertEqual(dashboard["summary"]["balanceCents"], 0)

    def test_transaction_crud_persists(self):
        self.client.force_login(self.user)
        payload = {"type": "expense", "description": "Lunch", "amountCents": 1250, "category": "Food", "date": date.today().isoformat(), "account": "Cash"}
        response = self.client.post("/api/transactions/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        pk = response.json()["id"]
        self.client.patch(f"/api/transactions/{pk}/", {**payload, "amountCents": 1500}, format="json")
        self.assertEqual(Transaction.objects.get(pk=pk).amount_cents, 1500)
        self.client.delete(f"/api/transactions/{pk}/")
        self.assertFalse(Transaction.objects.filter(pk=pk).exists())

    def test_invalid_input_is_rejected(self):
        self.client.force_login(self.user)
        payload = {"type": "expense", "description": "Invalid", "amountCents": 0, "category": "Food", "date": date.today().isoformat()}
        self.assertEqual(self.client.post("/api/transactions/", payload, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/transactions/", {**payload, "amountCents": 100, "category": "Salary"}, format="json").status_code, 400)
        self.assertEqual(self.client.get("/api/transactions/?month=2026-13").status_code, 400)
        self.assertEqual(self.client.get("/api/transactions/?from_date=not-a-date").status_code, 400)

    def test_ownership_isolation(self):
        other = User.objects.create_user("other@example.com", "study1234", display_name="Other Person")
        transaction = self.user.transactions.first()
        self.client.force_login(other)
        self.assertEqual(self.client.get(f"/api/transactions/{transaction.pk}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/transactions/{transaction.pk}/").status_code, 404)
        self.assertEqual(len(self.client.get("/api/transactions/").json()), 0)

    def test_budget_update_zero_removal_and_delete(self):
        self.client.force_login(self.user)
        month = current_month()
        response = self.client.put("/api/budgets/", {"category": "Food", "month": month, "amountCents": 60000}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.budgets.filter(category="Food", month=month).count(), 1)
        self.assertEqual(get_dashboard(self.user)["summary"]["budgetCents"], 225000)
        removed = self.client.put("/api/budgets/", {"category": "Food", "month": month, "amountCents": 0}, format="json")
        self.assertEqual(removed.status_code, 200)
        self.assertFalse(self.user.budgets.filter(category="Food", month=month).exists())
        rent = self.user.budgets.get(category="Rent", month=month)
        self.assertEqual(self.client.delete(f"/api/budgets/?id={rent.pk}").status_code, 204)
        self.assertFalse(self.user.budgets.filter(pk=rent.pk).exists())

    def test_personal_profile_password_change_and_duplicate_email(self):
        person = User.objects.create_user("person@example.com", "study1234", display_name="Pat Student")
        self.client.force_login(person)
        response = self.client.patch(
            "/api/profile/", {"name": "Pat Saver", "currency": "EUR", "current_password": "study1234", "new_password": "newpassword123"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/").json()["user"]["email"], "person@example.com")
        person.refresh_from_db()
        self.assertTrue(person.check_password("newpassword123"))
        self.assertEqual(self.client.patch("/api/profile/", {"email": DEMO_EMAIL}, format="json").status_code, 400)

    def test_demo_credentials_are_protected(self):
        self.client.force_login(self.user)
        response = self.client.patch("/api/profile/", {"current_password": DEMO_PASSWORD, "new_password": "anotherpass123"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.patch("/api/profile/", {"email": "someone@example.com"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/profile/", {"name": "Alex Saver"}, format="json").status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(DEMO_PASSWORD))
        self.assertEqual(self.user.email, DEMO_EMAIL)

    def test_export_keeps_amounts_numeric_and_health(self):
        self.client.force_login(self.user)
        response = self.client.get("/api/export/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        content = response.content.decode("utf-8-sig")
        self.assertIn("Grocery run", content)
        self.assertIn(",-64.50,", content)
        self.assertNotIn("'-", content)
        self.assertEqual(self.client.get("/api/health/").json()["ok"], True)
