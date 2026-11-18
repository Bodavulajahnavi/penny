from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("A superuser must have staff and superuser privileges.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField("email address", unique=True)
    display_name = models.CharField("display name", max_length=100)
    currency = models.CharField(max_length=3, default="USD", choices=[("USD", "USD"), ("EUR", "EUR"), ("GBP", "GBP"), ("INR", "INR")])
    is_demo = models.BooleanField(default=False)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def clean(self):
        self.email = self.__class__.objects.normalize_email(self.email)
        return super().clean()

    def save(self, *args, **kwargs):
        self.email = self.__class__.objects.normalize_email(self.email)
        return super().save(*args, **kwargs)


class Transaction(models.Model):
    class Type(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"

    class Category(models.TextChoices):
        FOOD = "Food", "Food"
        RENT = "Rent", "Rent"
        TRANSPORT = "Transport", "Transport"
        ENTERTAINMENT = "Entertainment", "Entertainment"
        SALARY = "Salary", "Salary"
        SHOPPING = "Shopping", "Shopping"
        OTHER = "Other", "Other"

    class Account(models.TextChoices):
        CHECKING = "Checking account", "Checking account"
        CREDIT = "Credit card", "Credit card"
        CASH = "Cash", "Cash"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    type = models.CharField(max_length=10, choices=Type.choices)
    description = models.CharField(max_length=120)
    amount_cents = models.PositiveIntegerField()
    category = models.CharField(max_length=30, choices=Category.choices)
    date = models.DateField()
    account = models.CharField(max_length=30, choices=Account.choices, default="Checking account")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["user", "date"])]
        constraints = [models.CheckConstraint(condition=models.Q(amount_cents__gt=0, amount_cents__lte=100000000), name="positive_transaction_amount"), models.CheckConstraint(condition=models.Q(type="income", category="Salary") | models.Q(type="expense") & ~models.Q(category="Salary"), name="consistent_income_category")]

    def clean(self):
        if self.type == "income" and self.category != "Salary":
            raise ValidationError({"category": "Income must use the Salary category."})
        if self.type == "expense" and self.category == "Salary":
            raise ValidationError({"category": "Salary is reserved for income."})
        return super().clean()

    def __str__(self):
        return f"{self.description}: {self.amount_cents / 100:.2f}"


class Budget(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="budgets")
    category = models.CharField(max_length=30, choices=[(c.value, c.value) for c in Transaction.Category if c != "Salary"])
    month = models.CharField(max_length=7, validators=[RegexValidator(r"^20\d{2}-(0[1-9]|1[0-2])$", "Use a month in YYYY-MM format.")])
    amount_cents = models.PositiveIntegerField()

    class Meta:
        ordering = ["category"]
        constraints = [models.UniqueConstraint(fields=["user", "category", "month"], name="unique_user_category_month"), models.CheckConstraint(condition=models.Q(amount_cents__gte=0, amount_cents__lte=100000000), name="valid_budget_amount")]

    def __str__(self):
        return f"{self.category} — {self.month}"
