from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Transaction, Budget


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", min_length=2, max_length=100)
    id = serializers.CharField(source="pk", read_only=True)
    isDemo = serializers.IntegerField(source="is_demo", read_only=True)
    createdAt = serializers.DateTimeField(source="date_joined", read_only=True)
    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=128)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=128)

    class Meta:
        model = get_user_model()
        fields = ["id", "name", "email", "currency", "isDemo", "createdAt", "current_password", "new_password"]


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=100)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_email(self, value):
        value = value.lower().strip()
        if get_user_model().objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        return get_user_model().objects.create_user(email=validated_data["email"], password=validated_data["password"], display_name=validated_data["name"])


class TransactionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    amountCents = serializers.IntegerField(source="amount_cents", min_value=1, max_value=100000000)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "type", "description", "amountCents", "category", "date", "account", "createdAt"]

    def validate(self, attrs):
        if attrs.get("type") == "income" and attrs.get("category") != "Salary":
            raise serializers.ValidationError({"category": "Income must use the Salary category."})
        if attrs.get("type") == "expense" and attrs.get("category") == "Salary":
            raise serializers.ValidationError({"category": "Salary is reserved for income."})
        return attrs


class BudgetSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    amountCents = serializers.IntegerField(source="amount_cents", min_value=0, max_value=100000000)

    class Meta:
        model = Budget
        fields = ["id", "category", "month", "amountCents"]

    def validate_category(self, value):
        if value == "Salary":
            raise serializers.ValidationError("Choose an expense category.")
        return value
