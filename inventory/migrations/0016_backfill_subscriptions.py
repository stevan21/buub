from datetime import timedelta

from django.db import migrations
from django.utils import timezone


def create_subs(apps, schema_editor):
    """Crée un abonnement d'essai (30 j) pour chaque établissement existant."""
    Bar = apps.get_model("inventory", "Bar")
    Subscription = apps.get_model("inventory", "Subscription")
    end = timezone.localdate() + timedelta(days=30)
    for bar in Bar.objects.all():
        Subscription.objects.get_or_create(
            bar=bar,
            defaults={"is_trial": True, "suspended": False, "current_period_end": end, "price": 10000},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0015_subscription_subscriptionpayment"),
    ]

    operations = [
        migrations.RunPython(create_subs, noop),
    ]
