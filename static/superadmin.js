/* ============================================================================
 * BUUB — Console plateforme (super-admin) · SPA à menu latéral.
 * ==========================================================================*/
(function () {
  "use strict";
  var CFG = window.ADMIN || {};
  var BARS = [], TOTALS = {}, BYTYPE = {};

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function fmtN(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR'); }
  function fmtXAF(n) { return fmtN(n) + ' XAF'; }
  function fmtDate(ms) { try { return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return '—'; } }
  function fmtISO(s) { if (!s) return '—'; var p = String(s).split('-'); if (p.length < 3) return String(s); return fmtDate(new Date(+p[0], +p[1] - 1, +p[2]).getTime()); }
  var TYPE_CLASS = { bar: 't-bar', cave: 't-cave', restaurant: 't-restaurant', bar_resto: 't-bar_resto' };
  var TITLES = { overview: ['i-grid', "Vue d'ensemble"], bars: ['i-store', 'Établissements'], members: ['i-users', 'Membres'], subs: ['i-card', 'Abonnements'], stats: ['i-chart', 'Statistiques'] };

  var toastTimer;
  function toast(msg) { var t = $('saToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  var grid = $('saGrid'), searchEl = $('saSearch'), typeEl = $('saType'), sortEl = $('saSort');
  var side = $('saSide'), overlay = $('saOverlay');

  /* ---- Navigation ---- */
  function navigateTo(page) {
    document.querySelectorAll('.sa-tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-page') === page); });
    document.querySelectorAll('.sa-page').forEach(function (p) { p.classList.toggle('active', p.id === 'page-' + page); });
    var t = TITLES[page] || TITLES.overview;
    $('saPageTitle').innerHTML = '<svg class="ico"><use href="#' + t[0] + '"/></svg> ' + t[1];
    if (page === 'overview') renderOverview();
    else if (page === 'bars') renderBars();
    else if (page === 'members') renderMembers();
    else if (page === 'subs') renderSubs();
    else if (page === 'stats') renderStats();
    closeSide();
  }
  function openSide() { side.classList.add('open'); overlay.classList.add('show'); }
  function closeSide() { side.classList.remove('open'); overlay.classList.remove('show'); }

  /* ---- Chargement ---- */
  function load() {
    fetch(CFG.barsUrl, { headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { if (r.status === 403) throw new Error('403'); if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) {
        BARS = d.bars || []; TOTALS = d.totals || {}; BYTYPE = d.by_type || {};
        $('tabBars').textContent = BARS.length;
        $('tabMembers').textContent = BARS.reduce(function (s, b) { return s + b.members; }, 0);
        $('tabSubs').textContent = TOTALS.subs_expired || 0;
        $('saGenerated').textContent = 'À jour · ' + BARS.length + ' établissement(s)';
        var active = document.querySelector('.sa-tab.active');
        navigateTo(active ? active.getAttribute('data-page') : 'overview');
      })
      .catch(function (e) {
        var msg = e.message === '403' ? 'Accès refusé — réservé à l\'administrateur (super-utilisateur).' : 'Impossible de charger les données.';
        grid.innerHTML = '<div class="sa-empty">' + msg + '</div>';
        $('saTop').innerHTML = '<div class="sa-empty">' + msg + '</div>';
      });
  }

  /* ---- Vue d'ensemble ---- */
  function renderOverview() {
    $('kScans').textContent = fmtN(TOTALS.scans_total);
    $('kScansToday').textContent = fmtN(TOTALS.scans_today);
    $('kScans7').textContent = fmtN(TOTALS.scans_7d);
    $('kBars').textContent = fmtN(TOTALS.bars);
    $('kMembers').textContent = fmtN(TOTALS.members);
    $('kSubsActive').textContent = fmtN(TOTALS.subs_active);
    var keys = Object.keys(BYTYPE);
    $('saByType').innerHTML = keys.map(function (k) { return '<span class="sa-chip">' + esc(k) + ' <b>' + BYTYPE[k] + '</b></span>'; }).join('');
    var top = BARS.slice().sort(function (a, b) { return b.scans_total - a.scans_total; }).slice(0, 6);
    $('saTop').innerHTML = top.length ? top.map(function (b, i) {
      return '<div class="sa-top-row"><span class="sa-top-rank">' + (i + 1) + '</span>'
        + '<span class="sa-top-name">' + esc(b.name) + ' <small>· ' + esc(b.type_label) + '</small></span>'
        + '<span class="sa-top-val">' + fmtN(b.scans_total) + ' scans</span></div>';
    }).join('') : '<div class="sa-empty">Aucun établissement.</div>';
  }

  /* ---- Établissements ---- */
  function filtered() {
    var q = (searchEl.value || '').trim().toLowerCase(), ty = typeEl.value, sort = sortEl.value;
    var list = BARS.filter(function (b) {
      if (ty && b.type !== ty) return false;
      if (q && (b.name || '').toLowerCase().indexOf(q) === -1 && (b.owner || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sort === 'today') return b.scans_today - a.scans_today;
      if (sort === 'members') return b.members - a.members;
      if (sort === 'recent') return b.created_at - a.created_at;
      return b.scans_total - a.scans_total;  // 'scans' (défaut)
    });
    return list;
  }
  function barCard(b) {
    var tcl = TYPE_CLASS[b.type] || 't-bar';
    var last = b.last_scan ? 'Dernier scan ' + fmtDate(b.last_scan) : 'Aucun scan';
    return '<div class="sa-bar" data-id="' + b.id + '">'
      + '<div class="sa-bar-head"><div><div class="sa-bar-name">' + esc(b.name) + '</div>'
      + '<div class="sa-bar-meta">' + esc(b.owner || 'sans gérant') + ' · ' + esc(b.type_label) + '</div></div>'
      + '<span class="sa-sbadge b-' + esc(b.sub_state) + '">' + esc(b.sub_state_label) + '</span></div>'
      + '<div class="sa-stats">'
      + '<div class="sa-stat"><div class="sa-stat-v">' + fmtN(b.scans_total) + '</div><div class="sa-stat-l">scans total</div></div>'
      + '<div class="sa-stat' + (b.scans_today ? ' warn' : '') + '"><div class="sa-stat-v">' + fmtN(b.scans_today) + '</div><div class="sa-stat-l">aujourd\'hui</div></div>'
      + '<div class="sa-stat"><div class="sa-stat-v">' + fmtN(b.scans_7d) + '</div><div class="sa-stat-l">7 jours</div></div>'
      + '</div>'
      + '<div class="sa-bar-foot"><div class="sa-foot-info">' + esc(last) + ' · ' + fmtN(b.members) + ' membre(s)</div>'
      + '<a class="sa-link" href="' + esc(b.menu_url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Voir le menu ↗</a></div>'
      + '</div>';
  }
  function renderBars() {
    var list = filtered();
    if (!list.length) { grid.innerHTML = '<div class="sa-empty">Aucun établissement ne correspond.</div>'; return; }
    grid.innerHTML = list.map(barCard).join('');
    grid.querySelectorAll('.sa-bar').forEach(function (el) { el.addEventListener('click', function () { openModal(this.getAttribute('data-id')); }); });
  }

  /* ---- Membres (organisés par établissement) ---- */
  function memberById(id) {
    for (var i = 0; i < BARS.length; i++) {
      var t = BARS[i].team || [];
      for (var j = 0; j < t.length; j++) if (String(t[j].id) === String(id)) return { m: t[j], bar: BARS[i] };
    }
    return null;
  }
  function memberRow(m, barId) {
    return '<div class="sa-member">'
      + '<span class="sa-ava">' + esc((m.username || '?').charAt(0).toUpperCase()) + '</span>'
      + '<div class="sa-member-main"><div class="sa-member-name">' + esc(m.username)
      + (m.is_superuser ? ' <span class="sa-super">super-admin</span>' : '') + '</div></div>'
      + '<span class="sa-role ' + esc(m.role) + '">' + (m.role === 'gerant' ? 'Gérant' : 'Serveur') + '</span>'
      + '<div class="sa-member-act">'
      + '<button class="sa-iconbtn" data-medit="' + m.id + '" data-bar="' + barId + '" title="Modifier">✎</button>'
      + (m.is_superuser ? '' : '<button class="sa-iconbtn danger" data-mdel="' + m.id + '" data-name="' + esc(m.username) + '" title="Supprimer">🗑</button>')
      + '</div></div>';
  }
  function renderMembers() {
    var q = ($('saMemberSearch').value || '').trim().toLowerCase();
    var host = $('saMembers');
    var bars = BARS.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
    var html = '', shown = 0;
    bars.forEach(function (b) {
      var team = (b.team || []).filter(function (m) {
        return !q || m.username.toLowerCase().indexOf(q) !== -1 || b.name.toLowerCase().indexOf(q) !== -1;
      });
      if (q && !team.length) return;   // en recherche : masquer les bars sans correspondance
      shown++;
      var gerants = team.filter(function (m) { return m.role === 'gerant'; });
      var serveurs = team.filter(function (m) { return m.role === 'serveur'; });
      html += '<div class="sa-panel sa-memgroup">'
        + '<div class="sa-memgroup-h"><div class="sa-memgroup-t"><b>' + esc(b.name) + '</b> '
        + '<span class="sa-type ' + (TYPE_CLASS[b.type] || 't-bar') + '">' + esc(b.type_label) + '</span>'
        + '<span class="sa-memcount">' + team.length + ' membre(s)</span></div>'
        + '<button class="sa-sbtn primary" data-madd="' + b.id + '">+ Membre</button></div>'
        + '<div class="sa-memgroup-b">'
        + (gerants.length ? '<div class="sa-memsub">Gérant' + (gerants.length > 1 ? 's' : '') + '</div>' + gerants.map(function (m) { return memberRow(m, b.id); }).join('') : '')
        + (serveurs.length ? '<div class="sa-memsub">Serveur' + (serveurs.length > 1 ? 's' : '') + '</div>' + serveurs.map(function (m) { return memberRow(m, b.id); }).join('') : '')
        + (!team.length ? '<div class="sa-pay-empty">Aucun membre. Ajoute un gérant ou un serveur.</div>' : '')
        + '</div></div>';
    });
    host.innerHTML = shown ? html : '<div class="sa-empty">Aucun membre.</div>';
    host.querySelectorAll('[data-madd]').forEach(function (x) { x.addEventListener('click', function () { openMemberModal(null, this.getAttribute('data-madd')); }); });
    host.querySelectorAll('[data-medit]').forEach(function (x) { x.addEventListener('click', function () { openMemberModal(this.getAttribute('data-medit'), this.getAttribute('data-bar')); }); });
    host.querySelectorAll('[data-mdel]').forEach(function (x) { x.addEventListener('click', function () { deleteMember(this.getAttribute('data-mdel'), this.getAttribute('data-name')); }); });
  }
  function deleteMember(id, name) {
    if (!confirm('Supprimer le membre « ' + name + ' » ? Son compte de connexion sera définitivement effacé.')) return;
    api(CFG.memberUrlBase + id + '/', 'DELETE', null, function (d) { replaceBar(d.bar); toast('Membre supprimé'); });
  }
  function roleSelect(cur) {
    return '<select id="saMemRole">'
      + '<option value="serveur"' + (cur === 'serveur' ? ' selected' : '') + '>Serveur</option>'
      + '<option value="gerant"' + (cur === 'gerant' ? ' selected' : '') + '>Gérant</option></select>';
  }
  function openMemberModal(memberId, barId) {
    var b = barById(barId);
    var mm = memberId ? memberById(memberId) : null;
    var m = mm ? mm.m : null;
    var h = '<div class="sa-mh"><div><h2>' + (m ? 'Modifier le membre' : 'Ajouter un membre') + '</h2>'
      + '<div class="sa-bar-meta">' + esc(b ? b.name : '') + '</div></div><button class="sa-x" id="saModalX">✕</button></div>';
    if (!m) {
      h += '<div class="sa-inline"><label>Identifiant (nom d\'utilisateur)</label><input type="text" id="saMemName" autocomplete="off"></div>'
        + '<div class="sa-inline"><label>Mot de passe</label><input type="text" id="saMemPwd" autocomplete="off"></div>'
        + '<div class="sa-inline"><label>Rôle</label>' + roleSelect('serveur') + '</div>'
        + '<div class="sa-mactions"><button class="sa-btn primary" id="saMemCreate">Créer le membre</button>'
        + '<button class="sa-btn" id="saMemCancel">Annuler</button></div>';
    } else {
      h += '<div class="sa-inline"><label>Identifiant</label><input type="text" id="saMemName" value="' + esc(m.username) + '"><button class="sa-sbtn" id="saMemRename">Renommer</button></div>'
        + '<div class="sa-inline"><label>Nouveau mot de passe</label><input type="text" id="saMemPwd" placeholder="nouveau mot de passe"><button class="sa-sbtn" id="saMemPwdBtn">Réinitialiser</button></div>'
        + '<div class="sa-inline"><label>Rôle</label>' + roleSelect(m.role) + '<button class="sa-sbtn" id="saMemRoleBtn">OK</button></div>'
        + (m.is_superuser
          ? '<p class="sa-hint-note">Compte super-administrateur : suppression désactivée ici.</p>'
          : '<div class="sa-mactions"><button class="sa-btn danger" id="saMemDel">Supprimer ce membre</button></div>');
    }
    $('saModalCard').innerHTML = h;
    $('saModal').hidden = false;
    $('saModalX').addEventListener('click', closeModal);
    if (!m) {
      $('saMemCancel').addEventListener('click', closeModal);
      $('saMemCreate').addEventListener('click', function () {
        var u = $('saMemName').value.trim(), p = $('saMemPwd').value;
        if (!u) { toast('Identifiant requis'); return; }
        if ((p || '').length < 4) { toast('Mot de passe : 4 caractères minimum'); return; }
        api(CFG.subUrlBase + barId + '/members/', 'POST', { username: u, password: p, role: $('saMemRole').value },
          function (d) { closeModal(); replaceBar(d.bar); toast('Membre ajouté'); });
      });
    } else {
      var mact = function (payload, msg) { api(CFG.memberUrlBase + m.id + '/', 'POST', payload, function (d) { replaceBar(d.bar); toast(msg); openMemberModal(m.id, barId); }); };
      $('saMemRename').addEventListener('click', function () {
        var u = $('saMemName').value.trim(); if (!u) { toast('Identifiant requis'); return; }
        mact({ action: 'rename', username: u }, 'Identifiant modifié');
      });
      $('saMemPwdBtn').addEventListener('click', function () {
        var p = $('saMemPwd').value; if ((p || '').length < 4) { toast('Mot de passe : 4 caractères minimum'); return; }
        mact({ action: 'password', password: p }, 'Mot de passe réinitialisé');
      });
      $('saMemRoleBtn').addEventListener('click', function () { mact({ action: 'role', role: $('saMemRole').value }, 'Rôle mis à jour'); });
      if (!m.is_superuser) $('saMemDel').addEventListener('click', function () {
        if (!confirm('Supprimer « ' + m.username + ' » ? Son compte sera effacé.')) return;
        api(CFG.memberUrlBase + m.id + '/', 'DELETE', null, function (d) { closeModal(); replaceBar(d.bar); toast('Membre supprimé'); });
      });
    }
  }

  /* ---- Appels API (JSON) ---- */
  function api(url, method, payload, done, fail) {
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: payload ? JSON.stringify(payload) : undefined
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || 'Échec de l\'opération');
          return j;
        });
      })
      .then(done)
      .catch(function (e) { toast(e.message); if (fail) fail(); });
  }
  function subApi(id, payload, done, fail) { api(CFG.subUrlBase + id + '/subscription/', 'POST', payload, done, fail); }
  // Remplace un bar dans la liste locale et rafraîchit la page active.
  function replaceBar(nb) {
    if (!nb) return;
    for (var i = 0; i < BARS.length; i++) { if (String(BARS[i].id) === String(nb.id)) { BARS[i] = nb; break; } }
    recomputeSubTotals();
    var active = document.querySelector('.sa-tab.active');
    var page = active ? active.getAttribute('data-page') : 'overview';
    if (page === 'subs') renderSubs();
    else if (page === 'bars') renderBars();
    else if (page === 'members') renderMembers();
    else if (page === 'stats') renderStats();
    else renderOverview();
  }

  /* ---- Abonnements ---- */
  function subInfo(b) {
    if (b.sub_suspended) return 'Compte suspendu manuellement';
    if (b.sub_active) return b.sub_days_left + ' jour(s) restant(s)' + (b.sub_end ? ' · échéance ' + fmtISO(b.sub_end) : '');
    return b.sub_end ? 'Expiré le ' + fmtISO(b.sub_end) : 'Aucun abonnement';
  }
  function subRow(b) {
    var st = b.sub_state || 'expired';
    return '<div class="sa-sub s-' + esc(st) + '">'
      + '<div class="sa-sub-main">'
      + '<div class="sa-sub-name">' + esc(b.name)
      + ' <span class="sa-sbadge b-' + esc(st) + '">' + esc(b.sub_state_label) + '</span></div>'
      + '<div class="sa-sub-info">' + esc(subInfo(b)) + '</div>'
      + '<div class="sa-sub-info">Souscrit le ' + fmtISO(b.sub_since) + ' · ' + fmtN(b.sub_price) + ' XAF/mois · '
      + (b.sub_payments || []).length + ' paiement(s)</div></div>'
      + '<div class="sa-sub-actions">'
      + '<button class="sa-sbtn primary" data-id="' + b.id + '" data-sub-act="extend">+1 mois</button>'
      + '<button class="sa-sbtn" data-id="' + b.id + '" data-sub-act="manage">Gérer</button>'
      + '</div></div>';
  }
  function renderSubs() {
    $('subActive').textContent = fmtN(TOTALS.subs_active);
    $('subExpired').textContent = fmtN(TOTALS.subs_expired);
    $('subMrr').textContent = fmtXAF(TOTALS.mrr);
    var host = $('saSubs');
    // À traiter d'abord : suspendus/expirés en tête, puis par échéance la plus proche.
    var list = BARS.slice().sort(function (a, b) {
      if (a.sub_active !== b.sub_active) return a.sub_active ? 1 : -1;
      return (a.sub_days_left || 0) - (b.sub_days_left || 0);
    });
    if (!list.length) { host.innerHTML = '<div class="sa-empty">Aucun établissement.</div>'; return; }
    host.innerHTML = list.map(subRow).join('');
    host.querySelectorAll('[data-sub-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id'), act = this.getAttribute('data-sub-act');
        if (act === 'manage') { openSubModal(id); return; }
        var self = this; self.disabled = true;
        subApi(id, { action: 'extend', months: 1, method: 'manuel' },
          function (d) { replaceBar(d.bar); toast('Abonnement prolongé d\'un mois'); },
          function () { self.disabled = false; });
      });
    });
  }
  function recomputeSubTotals() {
    var active = BARS.filter(function (b) { return b.sub_active; }).length;
    TOTALS.subs_active = active;
    TOTALS.subs_expired = BARS.length - active;
    TOTALS.mrr = BARS.reduce(function (s, b) { return s + (b.sub_active ? Number(b.sub_price) || 0 : 0); }, 0);
    // Le CA abonnements évolue à chaque prolongation (nouveau paiement encaissé).
    TOTALS.sub_revenue = BARS.reduce(function (s, b) { return s + (Number(b.sub_revenue) || 0); }, 0);
    $('tabSubs').textContent = TOTALS.subs_expired;
  }

  /* ---- Modale de gestion d'un abonnement ---- */
  function openSubModal(id) {
    var b = barById(id); if (!b) return;
    var st = b.sub_state || 'expired';
    var pays = (b.sub_payments || []).map(function (p) {
      return '<div class="sa-pay"><span>' + fmtISO(p.start) + ' → ' + fmtISO(p.end) + '</span>'
        + '<span class="sa-pay-meta">' + esc(p.method) + (p.by ? ' · ' + esc(p.by) : '') + ' · ' + fmtDate(p.at) + '</span>'
        + '<b>' + fmtXAF(p.amount) + '</b></div>';
    }).join('') || '<div class="sa-pay-empty">Aucun paiement enregistré.</div>';
    $('saModalCard').innerHTML =
      '<div class="sa-mh"><div><h2>' + esc(b.name) + '</h2>'
      + '<div class="sa-bar-meta">Abonnement · <span class="sa-sbadge b-' + esc(st) + '">' + esc(b.sub_state_label) + '</span></div></div>'
      + '<button class="sa-x" id="saModalX">✕</button></div>'
      + row('Souscrit le', fmtISO(b.sub_since))
      + row('Payé jusqu\'au', b.sub_end ? fmtISO(b.sub_end) : '—')
      + row('Jours restants', b.sub_active ? fmtN(b.sub_days_left) + ' jour(s)' : '0')
      + row('Prix mensuel', fmtXAF(b.sub_price))
      + row('Essai gratuit', b.sub_is_trial ? 'Oui' : 'Non')
      + '<div class="sa-sec">Prolonger</div>'
      + '<div class="sa-actrow">'
      + [1, 3, 6, 12].map(function (m) { return '<button class="sa-sbtn primary" data-months="' + m + '">+' + m + ' mois</button>'; }).join('')
      + '</div>'
      + '<div class="sa-sec">Dates & options</div>'
      + '<div class="sa-inline"><label>Date de fin exacte</label><input type="date" id="saSubEnd" value="' + esc(b.sub_end || '') + '"><button class="sa-sbtn" id="saSetEnd">OK</button></div>'
      + '<div class="sa-inline"><label>Essai gratuit (jours)</label><input type="number" id="saTrialDays" min="1" max="90" value="14"><button class="sa-sbtn" id="saSetTrial">OK</button></div>'
      + '<div class="sa-inline"><label>Prix mensuel (XAF)</label><input type="number" id="saSubPrice" min="0" step="500" value="' + (Number(b.sub_price) || 0) + '"><button class="sa-sbtn" id="saSetPrice">OK</button></div>'
      + '<div class="sa-actrow">'
      + (b.sub_suspended
        ? '<button class="sa-sbtn ok" id="saTgSusp">Réactiver le compte</button>'
        : '<button class="sa-sbtn danger" id="saTgSusp">Suspendre le compte</button>')
      + '<button class="sa-sbtn danger" id="saExpire">Expirer maintenant</button>'
      + '</div>'
      + '<div class="sa-sec">Derniers paiements</div>'
      + '<div class="sa-pays">' + pays + '</div>';
    $('saModal').hidden = false;
    $('saModalX').addEventListener('click', closeModal);
    function act(payload, msg) {
      subApi(b.id, payload, function (d) { replaceBar(d.bar); toast(msg); openSubModal(b.id); });
    }
    $('saModalCard').querySelectorAll('[data-months]').forEach(function (x) {
      x.addEventListener('click', function () {
        act({ action: 'extend', months: +this.getAttribute('data-months'), method: 'manuel' }, 'Abonnement prolongé');
      });
    });
    $('saSetEnd').addEventListener('click', function () {
      var v = $('saSubEnd').value;
      if (!v) { toast('Choisis une date'); return; }
      act({ action: 'set_end', date: v }, 'Date de fin mise à jour');
    });
    $('saSetTrial').addEventListener('click', function () { act({ action: 'trial', days: +$('saTrialDays').value || 14 }, 'Essai gratuit accordé'); });
    $('saSetPrice').addEventListener('click', function () { act({ action: 'set_price', price: +$('saSubPrice').value || 0 }, 'Prix mensuel mis à jour'); });
    $('saTgSusp').addEventListener('click', function () {
      act({ action: b.sub_suspended ? 'unsuspend' : 'suspend' }, b.sub_suspended ? 'Compte réactivé' : 'Compte suspendu');
    });
    $('saExpire').addEventListener('click', function () {
      if (confirm('Couper l\'accès de « ' + b.name + ' » immédiatement ?')) act({ action: 'expire' }, 'Abonnement expiré');
    });
  }

  /* ---- Modale d'édition d'un établissement ---- */
  function openEditModal(id) {
    var b = barById(id); if (!b) return;
    var TYPES = [['bar', 'Bar'], ['cave', 'Cave'], ['restaurant', 'Restaurant'], ['bar_resto', 'Bar-Restaurant']];
    $('saModalCard').innerHTML =
      '<div class="sa-mh"><div><h2>Modifier l\'établissement</h2><div class="sa-bar-meta">' + esc(b.name) + '</div></div>'
      + '<button class="sa-x" id="saModalX">✕</button></div>'
      + '<div class="sa-inline col"><label>Nom</label><input type="text" id="saBarName" maxlength="120" value="' + esc(b.name) + '"></div>'
      + '<div class="sa-inline col"><label>Type</label><select id="saBarType">'
      + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (b.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="sa-mactions"><button class="sa-btn primary" id="saBarSave">Enregistrer</button>'
      + '<button class="sa-btn" id="saBarCancel">Annuler</button></div>';
    $('saModal').hidden = false;
    $('saModalX').addEventListener('click', closeModal);
    $('saBarCancel').addEventListener('click', function () { openModal(id); });
    $('saBarSave').addEventListener('click', function () {
      var name = $('saBarName').value.trim();
      if (!name) { toast('Nom requis'); return; }
      api(CFG.subUrlBase + id + '/', 'POST', { name: name, type: $('saBarType').value }, function (d) {
        replaceBar(d.bar); toast('Établissement mis à jour'); openModal(id);
      });
    });
  }

  /* ---- Statistiques ---- */
  function chart(host, rows, fmt) {
    var max = rows.reduce(function (m, r) { return Math.max(m, r.v); }, 0) || 1;
    host.innerHTML = rows.length ? rows.map(function (r) {
      return '<div class="sa-chart-row"><span class="sa-chart-name">' + esc(r.name) + '</span>'
        + '<span class="sa-chart-track"><span class="sa-chart-fill" style="width:' + Math.max(4, Math.round(r.v / max * 100)) + '%"></span></span>'
        + '<span class="sa-chart-val">' + fmt(r.v) + '</span></div>';
    }).join('') : '<div class="sa-empty">Aucune donnée.</div>';
  }
  function renderStats() {
    $('sScans').textContent = fmtN(TOTALS.scans_total);
    $('sScansToday').textContent = fmtN(TOTALS.scans_today);
    $('sScans7').textContent = fmtN(TOTALS.scans_7d);
    $('sScansAvg').textContent = fmtN(BARS.length ? (TOTALS.scans_total / BARS.length) : 0);
    var byScans = BARS.slice().sort(function (a, b) { return b.scans_total - a.scans_total; }).slice(0, 10).map(function (b) { return { name: b.name, v: b.scans_total }; });
    var byCA = BARS.slice().sort(function (a, b) { return b.sub_revenue - a.sub_revenue; }).slice(0, 10).map(function (b) { return { name: b.name, v: b.sub_revenue }; });
    chart($('saChartScans'), byScans, fmtN);
    chart($('saChartCA'), byCA, fmtXAF);
  }

  /* ---- Modale détail ---- */
  function barById(id) { for (var i = 0; i < BARS.length; i++) if (String(BARS[i].id) === String(id)) return BARS[i]; return null; }
  function row(label, val) { return '<div class="sa-mrow"><span>' + esc(label) + '</span><b>' + val + '</b></div>'; }
  function openModal(id) {
    var b = barById(id); if (!b) return;
    var team = (b.team || []).map(function (m) {
      return '<div class="sa-mmember"><span>' + esc(m.username) + '</span><span class="sa-role ' + esc(m.role) + '">' + (m.role === 'gerant' ? 'Gérant' : 'Serveur') + '</span></div>';
    }).join('') || '<div class="sa-mmember"><span>Aucun membre</span></div>';
    var full = location.origin + b.menu_url;
    $('saModalCard').innerHTML =
      '<div class="sa-mh"><div><h2>' + esc(b.name) + '</h2><div class="sa-bar-meta">' + esc(b.type_label) + ' · créé le ' + fmtDate(b.created_at) + '</div></div>'
      + '<button class="sa-x" id="saModalX">✕</button></div>'
      + row('Scans du menu (total)', fmtN(b.scans_total))
      + row('Scans aujourd\'hui', fmtN(b.scans_today))
      + row('Scans (7 jours)', fmtN(b.scans_7d))
      + row('Dernier scan', b.last_scan ? fmtDate(b.last_scan) : '—')
      + row('Chiffre d\'affaires (abonnements)', fmtXAF(b.sub_revenue))
      + row('Abonnement', '<span class="sa-sbadge b-' + esc(b.sub_state) + '">' + esc(b.sub_state_label) + '</span> <small>' + esc(subInfo(b)) + '</small>')
      + row('Identifiant public', esc(b.slug))
      + '<div class="sa-team"><div class="sa-team-t">Équipe (' + b.members + ')</div>' + team + '</div>'
      + '<div class="sa-mactions"><a class="sa-btn primary" href="' + esc(b.menu_url) + '" target="_blank" rel="noopener">Ouvrir le menu QR</a>'
      + '<button class="sa-btn" id="saCopy">Copier le lien</button></div>'
      + '<div class="sa-mactions"><button class="sa-btn" id="saSubBtn">Abonnement</button>'
      + '<button class="sa-btn" id="saEditBtn">Modifier</button>'
      + '<button class="sa-btn danger" id="saDelBtn">Supprimer</button></div>';
    $('saModal').hidden = false;
    $('saModalX').addEventListener('click', closeModal);
    $('saCopy').addEventListener('click', function () { try { navigator.clipboard.writeText(full); toast('Lien copié'); } catch (e) { toast(full); } });
    $('saSubBtn').addEventListener('click', function () { openSubModal(b.id); });
    $('saEditBtn').addEventListener('click', function () { openEditModal(b.id); });
    $('saDelBtn').addEventListener('click', function () {
      var typed = prompt('⚠️ Suppression DÉFINITIVE de « ' + b.name + ' » : stock, commandes, équipe et historique seront effacés.\n\nTape le nom exact de l\'établissement pour confirmer :');
      if (typed === null) return;
      if (typed.trim() !== b.name) { toast('Nom incorrect — suppression annulée'); return; }
      api(CFG.subUrlBase + b.id + '/', 'DELETE', null, function () {
        closeModal(); toast('Établissement supprimé'); load();
      });
    });
  }
  function closeModal() { $('saModal').hidden = true; }

  /* ---- Événements ---- */
  document.querySelectorAll('.sa-tab').forEach(function (t) { t.addEventListener('click', function () { navigateTo(this.getAttribute('data-page')); }); });
  searchEl.addEventListener('input', renderBars);
  typeEl.addEventListener('change', renderBars);
  sortEl.addEventListener('change', renderBars);
  $('saMemberSearch').addEventListener('input', renderMembers);
  $('saRefresh').addEventListener('click', load);
  $('saMenuBtn').addEventListener('click', openSide);
  overlay.addEventListener('click', closeSide);
  $('saModalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('saModal').hidden) closeModal(); else closeSide(); } });

  load();
})();
