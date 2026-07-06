from django.contrib.auth import views as auth_views
from django.urls import path
from django.views.generic.base import RedirectView

from . import views

urlpatterns = [
    # Pages publiques & authentification
    path("", views.home, name="home"),
    path("signup/", views.signup, name="signup"),
    path("serveur/", views.serveur_login, name="serveur_login"),
    path("login/", auth_views.LoginView.as_view(template_name="registration/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("bienvenue/", views.after_login, name="post_login"),  # aiguillage post-connexion

    # Espace du bar
    path("dashboard/", views.index, name="dashboard"),
    path("caisse/", views.gerant, name="caisse"),
    path("equipe/", views.team, name="team"),
    path("equipe/<int:pk>/delete/", views.team_delete, name="team_delete"),
    path("qrcodes/", views.qrcodes, name="qrcodes"),
    path("reglages/", views.reglages, name="reglages"),
    path("gerant/", RedirectView.as_view(pattern_name="caisse", permanent=True)),

    # Abonnement de l'établissement (paywall)
    path("abonnement/", views.abonnement, name="abonnement"),

    # Console plateforme (super-admin) — tous les bars inscrits
    path("superadmin/", views.platform_admin, name="platform_admin"),
    path("api/admin/bars/", views.platform_bars, name="admin_bars"),
    path("api/admin/bars/<int:pk>/", views.admin_bar_detail, name="admin_bar_detail"),
    path("api/admin/bars/<int:pk>/subscription/", views.admin_subscription, name="admin_subscription"),
    path("api/admin/bars/<int:pk>/members/", views.admin_bar_members, name="admin_bar_members"),
    path("api/admin/members/<int:pk>/", views.admin_member_detail, name="admin_member_detail"),

    # Menu public à scanner (commande client par QR code)
    path("menu/<str:token>/", views.public_menu, name="public_menu"),
    path("menu/<str:token>/state/", views.public_menu_state),
    path("menu/<str:token>/order/", views.public_menu_order),

    path("sw.js", views.service_worker, name="sw"),

    # API
    path("api/state/", views.state),
    path("api/items/", views.items),
    path("api/items/<int:pk>/", views.item_detail),
    path("api/items/<int:pk>/move/", views.item_move),
    path("api/items/<int:pk>/price/", views.item_price),
    path("api/items/<int:pk>/category/", views.item_category),
    path("api/items/<int:pk>/kind/", views.item_kind),
    path("api/items/<int:pk>/update/", views.item_update),
    path("api/reset/", views.reset_stock),
    path("api/history/clear/", views.history_clear),
    path("api/todos/", views.todos),
    path("api/todos/<int:pk>/toggle/", views.todo_toggle),
    path("api/todos/<int:pk>/", views.todo_detail),

    # Commandes
    path("api/orders/", views.orders),
    path("api/orders/<int:pk>/", views.order_detail),

    # Commandes clients (QR) — validation à la caisse
    path("api/pending/<int:pk>/accept/", views.pending_accept),
    path("api/pending/<int:pk>/reject/", views.pending_reject),

    # Administration via modales du dashboard (SPA)
    path("api/settings/", views.settings_api),
    path("api/team/", views.team_api),
    path("api/team/<int:pk>/", views.team_member_api),
    path("api/qrcodes/", views.qrcodes_api),
    path("api/ads/", views.ads_api),
    path("api/ads/<int:pk>/", views.ad_detail_api),

    # Archives
    path("api/archive/run/", views.archive_run),
    path("api/archives/<int:pk>/", views.archive_detail),
    path("archive/<int:pk>/pdf/", views.archive_pdf),
    path("archive/<int:pk>/download/", views.archive_download),
]
