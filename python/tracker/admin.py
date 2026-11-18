from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Transaction, Budget

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "display_name", "is_staff", "is_active")
    ordering = ("email",)
    fieldsets = ((None, {"fields": ("email", "password")}), ("Personal info", {"fields": ("display_name", "currency")}), ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}), ("Important dates", {"fields": ("last_login", "date_joined")}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "display_name", "password1", "password2")}),)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("description", "user", "type", "category", "amount_cents", "date")
    list_filter = ("type", "category", "date")
    search_fields = ("description", "user__email")

@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("category", "user", "month", "amount_cents")
    list_filter = ("category", "month")
