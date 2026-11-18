from django.core.management.base import BaseCommand
from tracker.seed import seed_demo

class Command(BaseCommand):
    help = "Create the shared demo account (demo@example.com), or refresh its sample data if it is from an earlier day."
    def add_arguments(self, parser):
        parser.add_argument("--password", default="demo1234")
    def handle(self, *args, **options):
        user = seed_demo(options["password"])
        self.stdout.write(self.style.SUCCESS(f"Demo ready: {user.email} / {options['password']}"))
