import secrets
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

# Abonnement SaaS : 10 000 XAF / mois par établissement.
SUBSCRIPTION_PRICE = 10000
TRIAL_DAYS = 14        # essai gratuit à l'inscription
PERIOD_DAYS = 30       # durée d'un mois d'abonnement


def generate_token():
    """Jeton public aléatoire pour l'URL du menu à scanner (non devinable)."""
    return secrets.token_hex(16)


# Catégories proposées par défaut selon le type d'établissement (suggestions, modifiables).
DEFAULT_CATEGORIES = {
    "cave": ["Vins", "Spiritueux", "Bières", "Sans alcool", "Autres"],
    "bar": ["Bières", "Spiritueux", "Cocktails", "Sans alcool", "Snacks"],
    "restaurant": ["Entrées", "Plats", "Accompagnements", "Desserts", "Boissons"],
    "bar_resto": ["Boissons", "Entrées", "Plats", "Desserts", "Snacks"],
}

# Indices textuels d'une catégorie « nourriture » (tout le reste = boisson) — sert
# au pré-classement automatique. Le gérant garde le dernier mot via le champ Item.kind.
FOOD_CATEGORY_HINTS = (
    "entrée", "entree", "plat", "accompagn", "dessert", "snack", "nourriture",
    "manger", "food", "tapas", "pizza", "burger", "sandwich", "grillade",
    "salade", "viande", "poisson", "frite", "brochette",
)


def guess_kind(category):
    """Devine si une catégorie relève de la nourriture ('food') ou des boissons ('drink')."""
    c = (category or "").lower()
    return "food" if any(h in c for h in FOOD_CATEGORY_HINTS) else "drink"


class Bar(models.Model):
    """Un établissement (tenant). Chaque bar a ses propres données, isolées."""
    TYPE_CHOICES = [
        ("cave", "Cave"),
        ("bar", "Bar"),
        ("restaurant", "Restaurant"),
        ("bar_resto", "Bar-Restaurant"),
    ]
    name = models.CharField("Nom de l'établissement", max_length=120)
    slug = models.SlugField(unique=True)
    type = models.CharField("Type d'établissement", max_length=12, choices=TYPE_CHOICES, default="bar")
    public_token = models.CharField(max_length=32, unique=True, default=generate_token, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def noun(self):
        """Nom générique d'un article selon le type ('boisson' pour un bar, sinon 'article')."""
        return "boisson" if self.type == "bar" else "article"

    @property
    def noun_plural(self):
        return self.noun + "s"

    def category_suggestions(self):
        """Catégories par défaut du type + catégories déjà utilisées par les articles
        (uniques, ordre stable : défauts d'abord, puis personnalisées). Sert aux datalists
        et à l'ordre de groupage."""
        ordered = list(DEFAULT_CATEGORIES.get(self.type, DEFAULT_CATEGORIES["bar"]))
        seen = {c.lower() for c in ordered}
        for cat in self.items.exclude(category="").values_list("category", flat=True).distinct():
            if cat.lower() not in seen:
                ordered.append(cat)
                seen.add(cat.lower())
        return ordered

    @property
    def subscription_active(self):
        """True si l'établissement a un abonnement en cours (ou essai valide)."""
        sub = getattr(self, "subscription", None)
        return bool(sub and sub.is_active)


class Profile(models.Model):
    """Lie un utilisateur Django à un bar avec un rôle."""
    ROLE_CHOICES = [("gerant", "Gérant"), ("serveur", "Serveur")]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="members")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="gerant")

    @property
    def is_gerant(self):
        return self.role == "gerant"

    def __str__(self):
        return f"{self.user.username} — {self.bar.name} ({self.get_role_display()})"


class Item(models.Model):
    """Un article du stock (boisson, plat, etc.)."""
    KIND_CHOICES = [("drink", "Boisson"), ("food", "Nourriture")]
    BADGE_CHOICES = [
        ("", "Aucun"),
        ("new", "Nouveau"),
        ("popular", "Populaire"),
        ("promo", "Promo"),
        ("spicy", "Épicé"),
        ("veggie", "Végé"),
    ]

    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="items")
    name = models.CharField("Nom", max_length=120)
    category = models.CharField("Catégorie", max_length=60, blank=True, default="")
    kind = models.CharField("Type", max_length=8, choices=KIND_CHOICES, default="drink")
    description = models.CharField("Description", max_length=200, blank=True, default="")
    badge = models.CharField("Badge", max_length=10, choices=BADGE_CHOICES, blank=True, default="")
    quantity = models.IntegerField("Quantité", default=0)
    low_stock_threshold = models.IntegerField("Seuil d'alerte stock", default=5)
    price = models.DecimalField("Prix de vente (XAF)", max_digits=12, decimal_places=2, default=0)
    cost_price = models.DecimalField("Prix d'achat (XAF)", max_digits=12, decimal_places=2, default=0)
    promo_price = models.DecimalField("Prix promo (XAF)", max_digits=12, decimal_places=2, null=True, blank=True)
    image = models.ImageField("Photo", upload_to="items/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["bar", "name"], name="uniq_item_bar_name"),
        ]

    def __str__(self):
        return f"{self.name} ({self.quantity})"

    @property
    def on_promo(self):
        """True si un prix promo valide (>0 et < prix de vente) est défini."""
        return self.promo_price is not None and 0 < self.promo_price < self.price

    @property
    def effective_price(self):
        """Prix réellement facturé (promo si active, sinon prix de vente)."""
        return self.promo_price if self.on_promo else self.price

    @property
    def margin(self):
        """Marge unitaire = prix facturé − prix d'achat."""
        return self.effective_price - (self.cost_price or 0)

    @property
    def is_low_stock(self):
        return self.quantity <= (self.low_stock_threshold or 0)


class Movement(models.Model):
    """Un mouvement de stock (entrée / sortie / création / suppression / réinitialisation)."""
    TYPE_CHOICES = [
        ("in", "Entrée"),
        ("out", "Sortie"),
        ("create", "Création"),
        ("delete", "Suppression"),
        ("reset", "Réinitialisation"),
    ]
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="movements")
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.SET_NULL, related_name="movements")
    item_name = models.CharField(max_length=120)  # nom figé au moment du mouvement
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    qty = models.IntegerField(default=0)
    before = models.IntegerField(default=0)
    after = models.IntegerField(default=0)
    note = models.CharField(max_length=160, blank=True, default="")
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    ts = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ts"]  # du plus ancien au plus récent

    def __str__(self):
        return f"{self.ts:%Y-%m-%d %H:%M} {self.type} {self.item_name} x{self.qty}"


class Todo(models.Model):
    PRIORITY_CHOICES = [("low", "Basse"), ("medium", "Moyenne"), ("high", "Haute")]
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="todos")
    text = models.CharField(max_length=200)
    completed = models.BooleanField(default=False)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.text


class Order(models.Model):
    """Une commande (prise par le serveur) — décrémente le stock à la validation."""
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="orders")
    label = models.CharField("Table / client", max_length=120, blank=True, default="")
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Commande #{self.id} ({self.total} XAF)"


class OrderLine(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.SET_NULL)
    item_name = models.CharField(max_length=120)
    qty = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.qty} x {self.item_name}"


class Archive(models.Model):
    """Snapshot quotidien de l'historique + inventaire (téléchargeable)."""
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="archives")
    day = models.DateField("Jour")
    created_at = models.DateTimeField(auto_now_add=True)
    movements_count = models.IntegerField(default=0)
    total_in = models.IntegerField(default=0)
    total_out = models.IntegerField(default=0)
    sales_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    content = models.JSONField(default=dict)  # {summary, movements, stock}

    class Meta:
        ordering = ["-day"]  # plus récent en premier
        constraints = [
            models.UniqueConstraint(fields=["bar", "day"], name="uniq_archive_bar_day"),
        ]

    def __str__(self):
        return f"Archive {self.day}"


class PendingOrder(models.Model):
    """Commande envoyée par un client (QR code) — en attente de validation au comptoir.
    Ne touche pas au stock : c'est la validation par un serveur qui crée l'Order réelle."""
    STATUS_CHOICES = [("pending", "En attente"), ("done", "Validée"), ("rejected", "Refusée")]
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="pending_orders")
    table = models.CharField("Table", max_length=40, blank=True, default="")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # estimé à l'envoi
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]  # plus anciennes en premier (à traiter d'abord)

    def __str__(self):
        return f"Commande client {self.table} ({self.get_status_display()})"


class PendingOrderLine(models.Model):
    order = models.ForeignKey(PendingOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.SET_NULL)
    item_name = models.CharField(max_length=120)
    qty = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.qty} x {self.item_name}"


class MenuScan(models.Model):
    """Une consultation du menu public (scan du QR code d'une table).
    Chaque ouverture de la page menu crée un enregistrement -> statistiques d'affluence."""
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="scans")
    table = models.CharField(max_length=40, blank=True, default="")
    ts = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-ts"]  # plus récent en premier
        indexes = [models.Index(fields=["bar", "ts"])]

    def __str__(self):
        return f"Scan {self.bar.name} {self.ts:%Y-%m-%d %H:%M}"


class Subscription(models.Model):
    """Abonnement d'un établissement au service BUUB (10 000 XAF / mois)."""
    bar = models.OneToOneField(Bar, on_delete=models.CASCADE, related_name="subscription")
    is_trial = models.BooleanField("Essai gratuit", default=True)
    suspended = models.BooleanField("Suspendu", default=False)
    current_period_end = models.DateField("Payé jusqu'au", null=True, blank=True)
    price = models.DecimalField("Prix mensuel (XAF)", max_digits=10, decimal_places=2, default=SUBSCRIPTION_PRICE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Abonnement {self.bar.name} ({self.state_label})"

    @property
    def is_active(self):
        if self.suspended:
            return False
        return self.current_period_end is not None and self.current_period_end >= timezone.localdate()

    @property
    def days_left(self):
        if not self.current_period_end:
            return 0
        return (self.current_period_end - timezone.localdate()).days

    @property
    def state(self):
        if self.suspended:
            return "suspended"
        if self.is_active:
            return "trial" if self.is_trial else "active"
        return "expired"

    @property
    def state_label(self):
        return {"suspended": "Suspendu", "trial": "Essai gratuit",
                "active": "Actif", "expired": "Expiré"}[self.state]

    def extend(self, months=1, payment=True, method="manuel", note="", by=None):
        """Prolonge l'abonnement de `months` mois (30 j) à partir de la fin en cours
        ou d'aujourd'hui, réactive le compte, et enregistre le paiement."""
        today = timezone.localdate()
        base = self.current_period_end if (self.current_period_end and self.current_period_end > today) else today
        start = base
        self.current_period_end = base + timedelta(days=PERIOD_DAYS * months)
        self.is_trial = False
        self.suspended = False
        self.save()
        if payment:
            SubscriptionPayment.objects.create(
                bar=self.bar, amount=self.price * months, period_start=start,
                period_end=self.current_period_end, method=method, note=note,
                created_by=(by.username if by else ""),
            )
        return self


class SubscriptionPayment(models.Model):
    """Historique des paiements d'abonnement (confirmés manuellement pour l'instant)."""
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name="subscription_payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    period_start = models.DateField()
    period_end = models.DateField()
    method = models.CharField(max_length=30, default="manuel")  # manuel, momo, orange…
    note = models.CharField(max_length=160, blank=True, default="")
    created_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.bar.name} · {self.amount} XAF ({self.period_end})"
