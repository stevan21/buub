/* ============================================================================
 * BUUB — Mini-jeux pour patienter après la commande (menu client)
 * Autonome, sans dépendance. window.BuubGames = { open, close }.
 * Jeux : Dames (vs ordi), Échecs (vs ordi), Zuma (simplifié).
 * ==========================================================================*/
(function () {
  "use strict";

  function E(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // Icônes SVG (au lieu d'emojis) — trait, héritent de currentColor
  function ic(paths) { return '<svg class="bg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>'; }
  var ICONS = {
    dames: ic('<ellipse cx="12" cy="15.3" rx="7.3" ry="2.9"/><path d="M4.7 15.3v-3.6a7.3 2.9 0 0 1 14.6 0v3.6"/><ellipse cx="12" cy="8.4" rx="7.3" ry="2.9"/>'),
    chess: ic('<circle cx="12" cy="5" r="2.4"/><path d="M9.5 9.6h5l-1 4.2h-3z"/><path d="M6.6 20.5l1-6.7h8.8l1 6.7z"/><path d="M5 20.5h14"/>'),
    zuma: ic('<circle cx="8" cy="9" r="3.1"/><circle cx="16" cy="9" r="3.1"/><circle cx="12" cy="15.6" r="3.1"/>'),
    billard: ic('<circle cx="8" cy="15.5" r="4.6"/><line x1="11.4" y1="12.1" x2="21" y2="2.5"/><path d="M17.8 5.7 21 2.5"/>'),
    cpu: ic('<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/>'),
    users: ic('<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M18.5 20a5.5 5.5 0 0 0-3.4-5.1"/>')
  };

  var overlay, viewEl, titleEl, backBtn, current = null, teardown = null;

  function stopGame() { if (teardown) { try { teardown(); } catch (e) {} teardown = null; } }
  function newBtn(fn) { var b = E('button', 'bg-btn', '↻ Rejouer'); b.addEventListener('click', fn); return b; }
  // Sélecteur de mode : contre l'ordi / à deux (2 joueurs sur le même écran)
  function modeSeg(initial, onChange) {
    var seg = E('div', 'bg-modeseg'), btns = [];
    [['ai', ICONS.cpu, 'Contre l’ordi'], ['2p', ICONS.users, 'À deux']].forEach(function (o) {
      var b = E('button', 'bg-modebtn' + (o[0] === initial ? ' on' : ''));
      b.innerHTML = o[1] + '<span>' + o[2] + '</span>';
      b.addEventListener('click', function () { btns.forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); onChange(o[0]); });
      btns.push(b); seg.appendChild(b);
    });
    return seg;
  }

  function build() {
    overlay = E('div', 'bg-overlay'); overlay.hidden = true;
    var shell = E('div', 'bg-shell');
    var top = E('div', 'bg-top');
    backBtn = E('button', 'bg-nav'); backBtn.innerHTML = '&#8592;'; backBtn.setAttribute('aria-label', 'Retour');
    titleEl = E('span', 'bg-title', 'Jeux');
    var closeBtn = E('button', 'bg-nav'); closeBtn.innerHTML = '&#10005;'; closeBtn.setAttribute('aria-label', 'Fermer');
    top.appendChild(backBtn); top.appendChild(titleEl); top.appendChild(closeBtn);
    viewEl = E('div', 'bg-view');
    shell.appendChild(top); shell.appendChild(viewEl);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
    backBtn.addEventListener('click', function () { if (current) hub(); else close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (!overlay || overlay.hidden) return; if (e.key === 'Escape') { if (current) hub(); else close(); } });
  }

  function open() { if (!overlay) build(); overlay.hidden = false; document.body.style.overflow = 'hidden'; hub(); }
  function close() { stopGame(); if (overlay) overlay.hidden = true; document.body.style.overflow = ''; current = null; }

  function hub() {
    stopGame(); current = null;
    titleEl.textContent = 'En attendant… on joue ?';
    clear(viewEl);
    var grid = E('div', 'bg-hub');
    GAMES.forEach(function (g) {
      var b = E('button', 'bg-tile'); b.setAttribute('data-game', g.id);
      var em = E('span', 'bg-emoji'); em.innerHTML = ICONS[g.icon] || ''; b.appendChild(em);
      var tx = E('span', 'bg-txt');
      tx.appendChild(E('span', 'bg-name', g.name));
      tx.appendChild(E('span', 'bg-desc', g.desc));
      b.appendChild(tx);
      b.appendChild(E('span', 'bg-arrow', '→'));
      b.addEventListener('click', function () { launch(g); });
      grid.appendChild(b);
    });
    viewEl.appendChild(grid);
    viewEl.appendChild(E('p', 'bg-hint', 'Ta commande arrive — profites-en pour te détendre 🎲'));
  }

  function launch(g) { stopGame(); current = g; titleEl.textContent = g.name; clear(viewEl); vib(8); g.build(viewEl); }

  /* ============================ DAMES ============================ */
  function buildDames(view) {
    var B = [], sel = null, legal = [], turn = 'r', over = false, chaining = false, mode = 'ai';
    var status = E('div', 'bg-status', 'À toi (pions rouges)');
    var boardEl = E('div', 'bg-checkers');
    function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    function setup() {
      B = []; for (var r = 0; r < 8; r++) { var row = []; for (var c = 0; c < 8; c++) { var p = null; if ((r + c) % 2 === 1) { if (r < 3) p = { c: 'b', k: false }; else if (r > 4) p = { c: 'r', k: false }; } row.push(p); } B.push(row); }
      turn = 'r'; over = false; sel = null; legal = []; chaining = false;
    }
    var ALLD = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    // Déplacements simples (sans prise) : pions vers l'avant, dames volantes (toutes distances).
    function simpleMoves(r, c) {
      var p = B[r][c]; if (!p) return []; var out = [];
      if (p.k) {
        for (var i = 0; i < 4; i++) { var dr = ALLD[i][0], dc = ALLD[i][1], nr = r + dr, nc = c + dc; while (inB(nr, nc) && !B[nr][nc]) { out.push({ to: [nr, nc], cap: null }); nr += dr; nc += dc; } }
      } else {
        var fwd = p.c === 'r' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        for (var j = 0; j < 2; j++) { var r1 = r + fwd[j][0], c1 = c + fwd[j][1]; if (inB(r1, c1) && !B[r1][c1]) out.push({ to: [r1, c1], cap: null }); }
      }
      return out;
    }
    // Prises : pions dans les 4 diagonales (avant ET arrière) ; dames volantes.
    function captureMoves(r, c) {
      var p = B[r][c]; if (!p) return []; var out = [];
      for (var i = 0; i < 4; i++) {
        var dr = ALLD[i][0], dc = ALLD[i][1];
        if (p.k) {
          var nr = r + dr, nc = c + dc;
          while (inB(nr, nc) && !B[nr][nc]) { nr += dr; nc += dc; }
          if (inB(nr, nc) && B[nr][nc] && B[nr][nc].c !== p.c) {
            var lr = nr + dr, lc = nc + dc;
            while (inB(lr, lc) && !B[lr][lc]) { out.push({ to: [lr, lc], cap: [nr, nc] }); lr += dr; lc += dc; }
          }
        } else {
          var mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
          if (inB(tr, tc) && !B[tr][tc] && inB(mr, mc) && B[mr][mc] && B[mr][mc].c !== p.c) out.push({ to: [tr, tc], cap: [mr, mc] });
        }
      }
      return out;
    }
    function anyCapture(col) { for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) if (B[r][c] && B[r][c].c === col && captureMoves(r, c).length) return true; return false; }
    function anyMoves(col) { for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) if (B[r][c] && B[r][c].c === col && (simpleMoves(r, c).length || captureMoves(r, c).length)) return true; return false; }
    function count(col) { var n = 0; for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) if (B[r][c] && B[r][c].c === col) n++; return n; }
    function draw() {
      clear(boardEl);
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var sq = E('div', 'bg-sq ' + (((r + c) % 2) ? 'dark' : 'light'));
        if (sel && sel[0] === r && sel[1] === c) sq.classList.add('sel');
        if (legal.some(function (m) { return m.to[0] === r && m.to[1] === c; })) sq.classList.add('target');
        var p = B[r][c];
        if (p) { var pc = E('span', 'bg-piece ' + (p.c === 'r' ? 'red' : 'black') + (p.k ? ' king' : '')); if (p.k) pc.textContent = '♛'; sq.appendChild(pc); }
        (function (r, c) { sq.addEventListener('click', function () { onTap(r, c); }); })(r, c);
        boardEl.appendChild(sq);
      }
      if (!over) {
        if (mode === 'ai') status.textContent = turn === 'r' ? 'À toi (pions rouges)' : 'L’ordi réfléchit…';
        else status.textContent = turn === 'r' ? 'Au tour des Rouges' : 'Au tour des Noirs';
      }
    }
    function onTap(r, c) {
      if (over) return;
      if (mode === 'ai' && turn !== 'r') return;
      var mv = legal.filter(function (m) { return m.to[0] === r && m.to[1] === c; })[0];
      if (sel && mv) { doMove(sel[0], sel[1], mv); return; }
      if (chaining) return;               // en pleine rafle : on doit continuer avec la même pièce
      var p = B[r][c];
      if (p && p.c === turn) {
        var must = anyCapture(turn);
        var lm = must ? captureMoves(r, c) : simpleMoves(r, c);   // prise obligatoire
        if (lm.length) { sel = [r, c]; legal = lm; draw(); }
      }
    }
    function moveStep(r, c, m) { var p = B[r][c]; B[r][c] = null; if (m.cap) B[m.cap[0]][m.cap[1]] = null; B[m.to[0]][m.to[1]] = p; return p; }
    function crown(rr, cc) { var p = B[rr][cc]; if (p && !p.k && ((p.c === 'r' && rr === 0) || (p.c === 'b' && rr === 7))) p.k = true; }
    function doMove(r, c, m) {
      var col = B[r][c].c;
      moveStep(r, c, m); vib(m.cap ? 14 : 6);
      var tr = m.to[0], tc = m.to[1];
      // rafle : tant que la même pièce peut reprendre (pas de promotion en cours de rafle)
      if (m.cap) { var more = captureMoves(tr, tc); if (more.length) { sel = [tr, tc]; legal = more; chaining = true; draw(); return; } }
      crown(tr, tc); sel = null; legal = []; chaining = false; endTurn(col);
    }
    function endTurn(col) {
      var opp = col === 'r' ? 'b' : 'r';
      if (count(opp) === 0 || !anyMoves(opp)) {
        over = true;
        if (mode === '2p') status.textContent = (col === 'r' ? 'Les Rouges gagnent 🎉' : 'Les Noirs gagnent 🎉');
        else status.textContent = (col === 'r' ? 'Gagné ! 🎉' : 'L’ordi gagne 🤖');
        vib([10, 40, 80]); draw(); return;
      }
      turn = opp; draw();
      if (mode === 'ai' && turn === 'b') setTimeout(aiTurn, 420);
    }
    function aiTurn() {
      if (over) return;
      var must = anyCapture('b'), pool = [];
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = B[r][c]; if (p && p.c === 'b') { var lm = must ? captureMoves(r, c) : simpleMoves(r, c); for (var i = 0; i < lm.length; i++) pool.push({ from: [r, c], m: lm[i] }); } }
      if (!pool.length) { over = true; status.textContent = mode === '2p' ? 'Les Rouges gagnent 🎉' : 'Gagné ! 🎉'; draw(); return; }
      var pick = pool[Math.floor(Math.random() * pool.length)];
      moveStep(pick.from[0], pick.from[1], pick.m); vib(pick.m.cap ? 14 : 6);
      var cr = pick.m.to[0], cc = pick.m.to[1];
      if (pick.m.cap) { var guard = 0; while (guard++ < 15) { var more = captureMoves(cr, cc); if (!more.length) break; var mm = more[Math.floor(Math.random() * more.length)]; moveStep(cr, cc, mm); cr = mm.to[0]; cc = mm.to[1]; } }
      crown(cr, cc); endTurn('b');
    }
    function restart() { setup(); draw(); }
    setup();
    view.appendChild(modeSeg('ai', function (v) { mode = v; restart(); }));
    view.appendChild(status); view.appendChild(boardEl);
    view.appendChild(E('p', 'bg-hint', 'Prise obligatoire · les pions prennent aussi en arrière · les dames volent. Les rafles s’enchaînent !'));
    view.appendChild(newBtn(restart));
    draw();
  }

  /* ============================ ÉCHECS ============================ */
  function buildChess(view) {
    var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    var B, turn, over, sel, legal, mode = 'ai';
    var status = E('div', 'bg-status', 'À toi (blancs)');
    var boardEl = E('div', 'bg-checkers');
    function inb(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    function opp(c) { return c === 'w' ? 'b' : 'w'; }
    function clone(bd) { return bd.map(function (row) { return row.map(function (p) { return p ? { t: p.t, c: p.c } : null; }); }); }
    function setup() {
      var back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
      B = []; for (var r = 0; r < 8; r++) { var row = []; for (var c = 0; c < 8; c++) row.push(null); B.push(row); }
      for (var c = 0; c < 8; c++) { B[0][c] = { t: back[c], c: 'b' }; B[1][c] = { t: 'p', c: 'b' }; B[6][c] = { t: 'p', c: 'w' }; B[7][c] = { t: back[c], c: 'w' }; }
      turn = 'w'; over = false; sel = null; legal = [];
    }
    function pseudo(bd, r, c) {
      var p = bd[r][c]; if (!p) return []; var out = [], i, dr, dc, tr, tc;
      function add(tr, tc, promo) { out.push({ from: [r, c], to: [tr, tc], cap: bd[tr][tc], promo: !!promo }); }
      if (p.t === 'p') {
        var dir = p.c === 'w' ? -1 : 1, start = p.c === 'w' ? 6 : 1, prow = p.c === 'w' ? 0 : 7;
        if (inb(r + dir, c) && !bd[r + dir][c]) { add(r + dir, c, r + dir === prow); if (r === start && !bd[r + 2 * dir][c]) add(r + 2 * dir, c, false); }
        for (i = -1; i <= 1; i += 2) { tr = r + dir; tc = c + i; if (inb(tr, tc) && bd[tr][tc] && bd[tr][tc].c !== p.c) add(tr, tc, tr === prow); }
      } else if (p.t === 'n') {
        var K = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (i = 0; i < 8; i++) { tr = r + K[i][0]; tc = c + K[i][1]; if (inb(tr, tc) && (!bd[tr][tc] || bd[tr][tc].c !== p.c)) add(tr, tc); }
      } else if (p.t === 'k') {
        for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; tr = r + dr; tc = c + dc; if (inb(tr, tc) && (!bd[tr][tc] || bd[tr][tc].c !== p.c)) add(tr, tc); }
      } else {
        var dirs = [];
        if (p.t === 'r' || p.t === 'q') dirs = dirs.concat([[-1, 0], [1, 0], [0, -1], [0, 1]]);
        if (p.t === 'b' || p.t === 'q') dirs = dirs.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
        for (i = 0; i < dirs.length; i++) { tr = r; tc = c; while (true) { tr += dirs[i][0]; tc += dirs[i][1]; if (!inb(tr, tc)) break; if (!bd[tr][tc]) { add(tr, tc); } else { if (bd[tr][tc].c !== p.c) add(tr, tc); break; } } }
      }
      return out;
    }
    function findKing(bd, col) { for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = bd[r][c]; if (p && p.t === 'k' && p.c === col) return [r, c]; } return null; }
    function attacked(bd, r, c, by) {
      var i, tr, tc;
      var K = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (i = 0; i < 8; i++) { tr = r + K[i][0]; tc = c + K[i][1]; if (inb(tr, tc) && bd[tr][tc] && bd[tr][tc].c === by && bd[tr][tc].t === 'n') return true; }
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; tr = r + dr; tc = c + dc; if (inb(tr, tc) && bd[tr][tc] && bd[tr][tc].c === by && bd[tr][tc].t === 'k') return true; }
      var pr = by === 'w' ? r + 1 : r - 1;
      for (i = -1; i <= 1; i += 2) { if (inb(pr, c + i) && bd[pr][c + i] && bd[pr][c + i].c === by && bd[pr][c + i].t === 'p') return true; }
      var orth = [[-1, 0], [1, 0], [0, -1], [0, 1]], diag = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (i = 0; i < 4; i++) { tr = r; tc = c; while (true) { tr += orth[i][0]; tc += orth[i][1]; if (!inb(tr, tc)) break; var q = bd[tr][tc]; if (q) { if (q.c === by && (q.t === 'r' || q.t === 'q')) return true; break; } } }
      for (i = 0; i < 4; i++) { tr = r; tc = c; while (true) { tr += diag[i][0]; tc += diag[i][1]; if (!inb(tr, tc)) break; var q2 = bd[tr][tc]; if (q2) { if (q2.c === by && (q2.t === 'b' || q2.t === 'q')) return true; break; } } }
      return false;
    }
    function applyMove(bd, m) { var nb = clone(bd); var p = nb[m.from[0]][m.from[1]]; nb[m.from[0]][m.from[1]] = null; if (m.promo) p.t = 'q'; nb[m.to[0]][m.to[1]] = p; return nb; }
    function inCheck(bd, col) { var k = findKing(bd, col); return k ? attacked(bd, k[0], k[1], opp(col)) : true; }
    function legalMoves(bd, col) {
      var res = []; for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = bd[r][c]; if (p && p.c === col) { var ms = pseudo(bd, r, c); for (var i = 0; i < ms.length; i++) { if (!inCheck(applyMove(bd, ms[i]), col)) res.push(ms[i]); } } }
      return res;
    }
    // --- IA : negamax alpha-beta (pseudo + capture du roi) ---
    function evalSide(bd, col) {
      var s = 0;
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = bd[r][c]; if (!p) continue; var v = VAL[p.t]; var cen = 6 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)); v += cen; if (p.t === 'p') v += (p.c === 'w' ? (6 - r) : (r - 1)) * 4; s += p.c === 'w' ? v : -v; }
      return col === 'w' ? s : -s;
    }
    function genColor(bd, col) { var out = []; for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = bd[r][c]; if (p && p.c === col) out = out.concat(pseudo(bd, r, c)); } out.sort(function (a, b) { return (b.cap ? VAL[b.cap.t] : 0) - (a.cap ? VAL[a.cap.t] : 0); }); return out; }
    function negamax(bd, depth, alpha, beta, col) {
      if (depth <= 0) return evalSide(bd, col);
      var ms = genColor(bd, col), best = -1e9;
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].cap && ms[i].cap.t === 'k') return 900000;
        var sc = -negamax(applyMove(bd, ms[i]), depth - 1, -beta, -alpha, opp(col));
        if (sc > best) best = sc; if (best > alpha) alpha = best; if (alpha >= beta) break;
      }
      return best;
    }
    function aiMove() {
      var ms = legalMoves(B, 'b'); if (!ms.length) return null;
      ms.sort(function (a, b) { return (b.cap ? VAL[b.cap.t] : 0) - (a.cap ? VAL[a.cap.t] : 0); });
      var best = null, bs = -1e9;
      for (var i = 0; i < ms.length; i++) { var sc = -negamax(applyMove(B, ms[i]), 2, -1e9, 1e9, 'w'); if (sc > bs) { bs = sc; best = ms[i]; } }
      return best;
    }
    function draw() {
      clear(boardEl);
      var chk = inCheck(B, turn) ? findKing(B, turn) : null;
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var sq = E('div', 'bg-sq ' + (((r + c) % 2) ? 'dark' : 'light'));
        if (sel && sel[0] === r && sel[1] === c) sq.classList.add('sel');
        if (legal.some(function (m) { return m.to[0] === r && m.to[1] === c; })) sq.classList.add('target');
        if (chk && chk[0] === r && chk[1] === c) sq.classList.add('check');
        var p = B[r][c];
        if (p) { var pc = E('span', 'bg-cpiece ' + (p.c === 'w' ? 'w' : 'b'), GLYPH[p.t]); sq.appendChild(pc); }
        (function (r, c) { sq.addEventListener('click', function () { onTap(r, c); }); })(r, c);
        boardEl.appendChild(sq);
      }
    }
    function turnMsg() {
      if (mode === 'ai') return turn === 'w' ? 'À toi (blancs)' : 'L’ordi joue…';
      return turn === 'w' ? 'Au tour des Blancs' : 'Au tour des Noirs';
    }
    function endIf(col) {
      var ms = legalMoves(B, col);
      if (ms.length) { status.textContent = inCheck(B, col) ? 'Échec !' : turnMsg(); return false; }
      over = true;
      if (inCheck(B, col)) {
        var w = opp(col);
        if (mode === '2p') status.textContent = 'Échec et mat — ' + (w === 'w' ? 'Blancs' : 'Noirs') + ' gagnent ! 🎉';
        else status.textContent = col === 'w' ? 'Échec et mat — perdu 🤖' : 'Échec et mat — gagné ! 🎉';
        vib([10, 40, 90]);
      } else status.textContent = 'Pat — match nul 🤝';
      return true;
    }
    function onTap(r, c) {
      if (over) return;
      if (mode === 'ai' && turn !== 'w') return;
      var mv = legal.filter(function (m) { return m.to[0] === r && m.to[1] === c; })[0];
      if (sel && mv) {
        var mover = turn;
        B = applyMove(B, mv); vib(mv.cap ? 14 : 6); sel = null; legal = []; turn = opp(mover); draw();
        if (endIf(turn)) return;
        if (mode === 'ai' && turn === 'b') {
          status.textContent = 'L’ordi joue…';
          setTimeout(function () {
            var am = aiMove();
            if (am) { B = applyMove(B, am); vib(am.cap ? 14 : 6); }
            turn = 'w'; draw(); endIf('w');
          }, 260);
        }
        return;
      }
      var p = B[r][c];
      if (p && p.c === turn) { sel = [r, c]; legal = legalMoves(B, turn).filter(function (m) { return m.from[0] === r && m.from[1] === c; }); draw(); }
    }
    function restart() { setup(); draw(); status.textContent = turnMsg(); }
    setup();
    view.appendChild(modeSeg('ai', function (v) { mode = v; restart(); }));
    view.appendChild(status); view.appendChild(boardEl);
    view.appendChild(E('p', 'bg-hint', 'Touche une pièce puis une case verte. (Roque non géré, pion promu en dame.)'));
    view.appendChild(newBtn(restart));
    draw();
  }

  /* ============================ ZUMA (simplifié) ============================ */
  function buildZuma(view) {
    var status = E('div', 'bg-status', 'Aligne 3 boules ou plus !');
    var wrap = E('div', 'bg-zuma');
    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    var W = Math.min(window.innerWidth * 0.92, 460); W = Math.round(W);
    canvas.width = W; canvas.height = W;
    var ctx = canvas.getContext('2d');
    var cx = W / 2, cy = W / 2;
    var COLORS = ['#e2542a', '#e6c25a', '#2f8f4e', '#3182ce', '#8e44ad'];
    var R = Math.max(9, Math.round(W * 0.028)), SP = R * 2.05;

    // --- chemin en spirale (d=0 extérieur -> d=L trou intérieur) ---
    var pts = [], cum = [0], L = 0;
    (function () {
      var turns = 3.15, amax = turns * 2 * Math.PI, rMax = W * 0.45, rMin = R * 2.4, prev = null;
      for (var a = 0; a <= amax; a += 0.05) {
        var fr = a / amax, rr = rMax + (rMin - rMax) * fr;
        var x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
        pts.push([x, y]); if (prev) { L += Math.hypot(x - prev[0], y - prev[1]); cum.push(L); } prev = [x, y];
      }
    })();
    function at(d) {
      if (d <= 0) return pts[0]; if (d >= L) return pts[pts.length - 1];
      var lo = 0, hi = cum.length - 1;
      while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (cum[mid] < d) lo = mid; else hi = mid; }
      var t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
      return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
    }

    var chain, lead, spawnLeft, speed, projs, cur, next, aim, over, win, running = true, last = 0;
    function rc() { return Math.floor(Math.random() * COLORS.length); }
    function reset() {
      chain = []; lead = 0; spawnLeft = 34; speed = W * 0.03; projs = []; cur = rc(); next = rc(); aim = -Math.PI / 2; over = false; win = false;
      status.textContent = 'Aligne 3 boules ou plus !';
    }
    function resolve(idx) {
      var changed = true;
      while (changed) {
        changed = false;
        if (idx < 0 || idx >= chain.length) break;
        var col = chain[idx], i0 = idx, i1 = idx;
        while (i0 - 1 >= 0 && chain[i0 - 1] === col) i0--;
        while (i1 + 1 < chain.length && chain[i1 + 1] === col) i1++;
        if (i1 - i0 + 1 >= 3) { chain.splice(i0, i1 - i0 + 1); vib(20); idx = i0 - 1; if (idx >= 0 && idx + 1 < chain.length && chain[idx] === chain[idx + 1]) changed = true; }
      }
    }
    function shoot() {
      if (over) return;
      projs.push({ x: cx, y: cy, vx: Math.cos(aim) * W * 1.5, vy: Math.sin(aim) * W * 1.5, col: cur });
      cur = next; next = rc(); vib(6);
    }
    function step(dt) {
      if (over) return;
      lead += speed * dt;
      while (spawnLeft > 0 && chain.length <= Math.floor(lead / SP)) { chain.push(rc()); spawnLeft--; }
      if (lead >= L && chain.length) { over = true; status.textContent = 'Perdu — la file a atteint le trou 💀'; vib([40, 60, 120]); return; }
      if (!chain.length && spawnLeft === 0) { over = true; win = true; status.textContent = 'Gagné ! Toutes les boules éliminées 🎉'; vib([10, 40, 90]); return; }
      for (var pi = projs.length - 1; pi >= 0; pi--) {
        var p = projs[pi]; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -R || p.x > W + R || p.y < -R || p.y > W + R) { projs.splice(pi, 1); continue; }
        for (var i = 0; i < chain.length; i++) {
          var d = lead - i * SP; if (d < 0) continue; var pos = at(d);
          if (Math.hypot(p.x - pos[0], p.y - pos[1]) < R * 1.9) { chain.splice(i, 0, p.col); projs.splice(pi, 1); resolve(i); break; }
        }
      }
    }
    function render() {
      ctx.clearRect(0, 0, W, W);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      function trace() { ctx.beginPath(); for (var i = 0; i < pts.length; i++) { if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]); else ctx.lineTo(pts[i][0], pts[i][1]); } }
      trace(); ctx.strokeStyle = 'rgba(44,32,24,.16)'; ctx.lineWidth = R * 2 + 8; ctx.stroke();
      trace(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = R * 2 - 2; ctx.stroke();
      // trou (skull)
      var hole = at(L);
      ctx.beginPath(); ctx.arc(hole[0], hole[1], R * 1.5, 0, 7); ctx.fillStyle = '#3a2a1c'; ctx.fill();
      ctx.beginPath(); ctx.arc(hole[0], hole[1], R * 1.05, 0, 7); ctx.fillStyle = '#140d08'; ctx.fill();
      // file de billes
      for (var i = 0; i < chain.length; i++) { var dd = lead - i * SP; if (dd < 0) continue; var q = at(dd); ball(q[0], q[1], COLORS[chain[i]]); }
      // projectiles
      for (i = 0; i < projs.length; i++) ball(projs[i].x, projs[i].y, COLORS[projs[i].col]);
      // guide de visée
      ctx.save(); ctx.setLineDash([5, 8]); ctx.strokeStyle = 'rgba(44,32,24,.28)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aim) * W * 0.46, cy + Math.sin(aim) * W * 0.46); ctx.stroke(); ctx.restore();
      // grenouille
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.8, 0, 7); ctx.fillStyle = '#2f8f4e'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.8, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 2; ctx.stroke();
      var fx = Math.cos(aim), fy = Math.sin(aim), px = -fy, py = fx, ecx = cx + fx * R * 0.7, ecy = cy + fy * R * 0.7;
      [[ecx + px * R * 0.78, ecy + py * R * 0.78], [ecx - px * R * 0.78, ecy - py * R * 0.78]].forEach(function (e) {
        ctx.beginPath(); ctx.arc(e[0], e[1], R * 0.44, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(e[0] + fx * R * 0.15, e[1] + fy * R * 0.15, R * 0.2, 0, 7); ctx.fillStyle = '#14100a'; ctx.fill();
      });
      ball(cx, cy, COLORS[cur]);
      // aperçu de la bille suivante (coin)
      ball(W - R * 1.5, W - R * 1.5, COLORS[next]);
    }
    function ball(x, y, col) {
      ctx.beginPath(); ctx.arc(x, y + R * 0.16, R, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fill();
      var g = ctx.createRadialGradient(x - R * 0.32, y - R * 0.34, R * 0.15, x, y, R);
      g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.32, col); g.addColorStop(1, col);
      ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - R * 0.3, y - R * 0.33, R * 0.24, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    }
    function frame(t) {
      if (!running || !canvas.isConnected) return;
      if (!last) last = t; var dt = Math.min(0.05, (t - last) / 1000); last = t;
      step(dt); render();
      requestAnimationFrame(frame);
    }
    function pt(e) { var rct = canvas.getBoundingClientRect(); var cxp = (e.touches ? e.touches[0].clientX : e.clientX) - rct.left; var cyp = (e.touches ? e.touches[0].clientY : e.clientY) - rct.top; return [cxp * W / rct.width, cyp * W / rct.height]; }
    function aimAt(e) { var q = pt(e); aim = Math.atan2(q[1] - cy, q[0] - cx); }
    canvas.addEventListener('pointermove', function (e) { aimAt(e); });
    canvas.addEventListener('pointerdown', function (e) { aimAt(e); shoot(); });
    teardown = function () { running = false; };
    reset();
    view.appendChild(status); view.appendChild(wrap);
    view.appendChild(E('p', 'bg-hint', 'Vise avec le doigt, touche pour tirer. Élimine la file avant qu’elle n’atteigne le trou.'));
    view.appendChild(newBtn(function () { reset(); }));
    requestAnimationFrame(frame);
  }

  /* ============================ BILLARD ============================ */
  function buildBillard(view) {
    var mode = 'ai';
    var status = E('div', 'bg-status', '');
    var wrap = E('div', 'bg-billard');
    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas);

    var Wt = Math.min(window.innerWidth * 0.92, 400); Wt = Math.round(Wt);
    var Ht = Math.round(Wt * 1.55);
    canvas.width = Wt; canvas.height = Ht;
    var ctx = canvas.getContext('2d');

    var M = Math.round(Wt * 0.08);
    var L = M, Rr = Wt - M, T = M, Bb = Ht - M, MIDY = (T + Bb) / 2;
    var BR = Math.max(8, Math.round(Wt * 0.03));
    var POCK = BR * 1.75;
    var MAXV = Wt * 6.5, maxPull = Wt * 0.5;
    var pockets = [[L, T], [Rr, T], [L, Bb], [Rr, Bb], [L, MIDY], [Rr, MIDY]];
    var COL = { 1: '#f4c430', 2: '#1e56c8', 3: '#d8332a', 4: '#7b2d8b', 5: '#e8720c', 6: '#1f8a4c', 7: '#8a3324', 8: '#151515', 9: '#f4c430', 10: '#1e56c8', 11: '#d8332a', 12: '#7b2d8b', 13: '#e8720c', 14: '#1f8a4c', 15: '#8a3324' };
    function typeOf(n) { return n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe'; }

    var balls, cur, groups, open, phase, ballInHand, placing, aiming, aimX, aimY, over, winner, running = true, last = 0, msg = '';
    var firstHit, contact, railHit, pots, cueScratch;

    function cueB() { return balls[0]; }
    function home() { return [(L + Rr) / 2, Bb - (Bb - T) * 0.2]; }
    function moving() { for (var i = 0; i < balls.length; i++) { var b = balls[i]; if (!b.potted && (b.vx || b.vy)) return true; } return false; }
    function other(p) { return p ? 0 : 1; }
    function pName(p) { return mode === 'ai' ? (p === 0 ? 'Toi' : 'Ordi') : ('Joueur ' + (p + 1)); }
    function gLabel(g) { return g === 'solid' ? 'pleines' : g === 'stripe' ? 'rayées' : ''; }
    function gRemain(g) { if (!g) return 99; var n = 0; for (var i = 1; i < balls.length; i++) { var b = balls[i]; if (b.type === g && !b.potted) n++; } return n; }
    function pottedOf(tp) { var n = 0; for (var i = 0; i < pots.length; i++) if (pots[i].type === tp) n++; return n; }

    function setStatus() {
      var s;
      if (over) s = pName(winner) + ' gagne ! 🎉';
      else {
        s = pName(cur);
        var g = groups[cur];
        s += g ? ' · ' + gLabel(g) + ' (' + gRemain(g) + ')' : ' · table ouverte';
        if (ballInHand) s += ' · bille en main';
        if (msg) s = msg + ' · ' + s;
      }
      status.textContent = s;
    }

    function newShot() { firstHit = null; contact = false; railHit = false; pots = []; cueScratch = false; }

    function setup() {
      balls = [];
      var h = home();
      balls.push({ num: 0, type: 'cue', col: '#fdfdfd', x: h[0], y: h[1], vx: 0, vy: 0, r: BR, potted: false });
      var nums = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
      for (var a = nums.length - 1; a > 0; a--) { var bi = Math.floor(Math.random() * (a + 1)); var t = nums[a]; nums[a] = nums[bi]; nums[bi] = t; }
      var apexX = (L + Rr) / 2, apexY = T + (Bb - T) * 0.22, idx = 0, ni = 0;
      for (var row = 0; row < 5; row++) {
        for (var c = 0; c <= row; c++) {
          var x = apexX + (c - row / 2) * (BR * 2.04), y = apexY + row * (BR * 1.77);
          var num = idx === 4 ? 8 : nums[ni++];
          balls.push({ num: num, type: typeOf(num), col: COL[num], x: x, y: y, vx: 0, vy: 0, r: BR, potted: false });
          idx++;
        }
      }
      cur = 0; groups = [null, null]; open = true; phase = 'aim';
      ballInHand = false; placing = false; aiming = false; over = false; winner = -1;
      newShot(); msg = 'Casse !'; setStatus();
      if (mode === 'ai' && cur === 1) scheduleAI();
    }

    function shoot(dx, dy, power) {
      newShot(); var d = Math.hypot(dx, dy) || 1; var cb = cueB();
      cb.vx = dx / d * MAXV * power; cb.vy = dy / d * MAXV * power; phase = 'rolling'; msg = ''; vib(12);
    }

    function step(dt) {
      var i, b, damp = Math.max(0, 1 - 2.0 * dt);
      for (i = 0; i < balls.length; i++) {
        b = balls[i]; if (b.potted) continue;
        b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= damp; b.vy *= damp;
        if (Math.abs(b.vx) < 2) b.vx = 0; if (Math.abs(b.vy) < 2) b.vy = 0;
        var pk, done = false;
        for (pk = 0; pk < pockets.length; pk++) {
          if (Math.hypot(b.x - pockets[pk][0], b.y - pockets[pk][1]) < POCK) {
            b.potted = true; b.vx = b.vy = 0; if (b.type === 'cue') cueScratch = true; pots.push(b); vib(15); done = true; break;
          }
        }
        if (done) continue;
        if (b.x - b.r < L) { b.x = L + b.r; b.vx = -b.vx * 0.85; if (contact) railHit = true; }
        if (b.x + b.r > Rr) { b.x = Rr - b.r; b.vx = -b.vx * 0.85; if (contact) railHit = true; }
        if (b.y - b.r < T) { b.y = T + b.r; b.vy = -b.vy * 0.85; if (contact) railHit = true; }
        if (b.y + b.r > Bb) { b.y = Bb - b.r; b.vy = -b.vy * 0.85; if (contact) railHit = true; }
      }
      for (i = 0; i < balls.length; i++) {
        var a2 = balls[i]; if (a2.potted) continue;
        for (var jj = i + 1; jj < balls.length; jj++) {
          var c2 = balls[jj]; if (c2.potted) continue;
          var dx = c2.x - a2.x, dy = c2.y - a2.y, dist = Math.hypot(dx, dy), mn = a2.r + c2.r;
          if (dist > 0 && dist < mn) {
            var nx = dx / dist, ny = dy / dist, ov = (mn - dist) / 2;
            a2.x -= nx * ov; a2.y -= ny * ov; c2.x += nx * ov; c2.y += ny * ov;
            var rel = (c2.vx - a2.vx) * nx + (c2.vy - a2.vy) * ny;
            if (rel < 0) {
              a2.vx += rel * nx; a2.vy += rel * ny; c2.vx -= rel * nx; c2.vy -= rel * ny;
              if (!firstHit) { if (a2.type === 'cue') firstHit = c2; else if (c2.type === 'cue') firstHit = a2; if (firstHit) contact = true; }
              vib(4);
            }
          }
        }
      }
      if (phase === 'rolling' && !moving()) resolve();
    }

    function resolve() {
      phase = 'eval';
      var me = cur, g = groups[me], i;
      var remBefore = g ? gRemain(g) + pottedOf(g) : 99;
      if (cueScratch) cueB().potted = false;                 // on récupère la blanche
      var foul = false, reason = '';
      if (cueScratch) { foul = true; reason = 'blanche empochée'; }
      else if (!firstHit) { foul = true; reason = 'aucune bille touchée'; }
      else if (open) { if (firstHit.type === 'eight') { foul = true; reason = 'pas la 8 en premier'; } }
      else {
        var mustEight = g && remBefore === 0;
        if (mustEight) { if (firstHit.type !== 'eight') { foul = true; reason = 'vise la 8'; } }
        else if (firstHit.type === 'eight') { foul = true; reason = 'pas la 8 en premier'; }
        else if (g && firstHit.type !== g) { foul = true; reason = 'mauvais groupe'; }
      }
      if (!foul && firstHit && pots.length === 0 && !railHit) { foul = true; reason = 'aucune bande'; }

      var eight = false; for (i = 0; i < pots.length; i++) if (pots[i].type === 'eight') eight = true;
      if (eight) {
        over = true;
        var clearedBefore = g && remBefore === 0;
        winner = (clearedBefore && !foul) ? me : other(me);
        vib([10, 40, 90]); phase = 'over'; setStatus(); return;
      }

      if (!foul && open) {
        var own = null;
        for (i = 0; i < pots.length; i++) { var tp = pots[i].type; if (tp === 'solid' || tp === 'stripe') { own = pots[i]; break; } }
        if (own) { groups[me] = own.type; groups[other(me)] = own.type === 'solid' ? 'stripe' : 'solid'; open = false; g = groups[me]; }
      }

      if (foul) {
        cur = other(me); ballInHand = true;
        var hh = home(), cb = cueB(); cb.x = hh[0]; cb.y = hh[1]; cb.vx = cb.vy = 0;
        msg = 'Faute (' + reason + ')';
      } else {
        var g2 = groups[me], mine = false;
        if (g2) for (i = 0; i < pots.length; i++) if (pots[i].type === g2) mine = true;
        if (mine) msg = 'Rejoue !';
        else { cur = other(me); msg = ''; }
      }
      phase = 'aim'; setStatus();
      if (!over && mode === 'ai' && cur === 1) scheduleAI();
    }

    /* ---- IA (visée « bille fantôme » vers une poche) ---- */
    function aiTargets() {
      var g = groups[cur], list = [];
      for (var i = 1; i < balls.length; i++) {
        var b = balls[i]; if (b.potted) continue;
        if (open) { if (b.type !== 'eight') list.push(b); }
        else if (g && gRemain(g) > 0) { if (b.type === g) list.push(b); }
        else { if (b.type === 'eight') list.push(b); }
      }
      return list;
    }
    function blocked(x0, y0, x1, y1, ign) {
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i]; if (b.potted || b === ign || b.type === 'cue') continue;
        var dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy; if (len2 < 1) continue;
        var tt = ((b.x - x0) * dx + (b.y - y0) * dy) / len2; if (tt < 0.02 || tt > 0.99) continue;
        if (Math.hypot(b.x - (x0 + dx * tt), b.y - (y0 + dy * tt)) < BR * 1.9) return true;
      }
      return false;
    }
    function aiChoose() {
      var cb = cueB(), best = null, ts = aiTargets();
      for (var ti = 0; ti < ts.length; ti++) {
        var t = ts[ti];
        for (var pi = 0; pi < pockets.length; pi++) {
          var p = pockets[pi];
          var tpx = p[0] - t.x, tpy = p[1] - t.y, tpd = Math.hypot(tpx, tpy) || 1, ux = tpx / tpd, uy = tpy / tpd;
          var gx = t.x - ux * BR * 2, gy = t.y - uy * BR * 2;
          var cgx = gx - cb.x, cgy = gy - cb.y, cgd = Math.hypot(cgx, cgy) || 1;
          if ((cgx / cgd) * ux + (cgy / cgd) * uy < 0.25) continue;      // angle trop fermé
          if (blocked(cb.x, cb.y, gx, gy, t)) continue;
          if (blocked(t.x, t.y, p[0], p[1], t)) continue;
          var score = ((cgx / cgd) * ux + (cgy / cgd) * uy) * 2 - cgd / Wt - tpd / Wt;
          if (!best || score > best.score) best = { dx: cgx, dy: cgy, power: Math.min(1, 0.4 + (cgd + tpd) / (Wt * 1.7)), score: score };
        }
      }
      return best;
    }
    function aiPlay() {
      if (over || phase !== 'aim' || !(mode === 'ai' && cur === 1)) return;
      if (ballInHand) { var hh = home(), c0 = cueB(); c0.x = hh[0]; c0.y = hh[1]; ballInHand = false; setStatus(); }
      var s = aiChoose(), cb = cueB();
      if (s) { var ang = Math.atan2(s.dy, s.dx) + (Math.random() - 0.5) * 0.07, mag = Math.hypot(s.dx, s.dy); shoot(Math.cos(ang) * mag, Math.sin(ang) * mag, s.power); }
      else { var ts = aiTargets(); if (ts.length) shoot(ts[0].x - cb.x, ts[0].y - cb.y, 0.6); else shoot((L + Rr) / 2 - cb.x, T - cb.y, 0.5); }
    }
    function scheduleAI() { setTimeout(function () { if (running) aiPlay(); }, 750); }

    /* ---- rendu ---- */
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function shadeBall(x, y, col) {
      ctx.beginPath(); ctx.arc(x, y + BR * 0.16, BR, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();
      var g = ctx.createRadialGradient(x - BR * 0.3, y - BR * 0.32, BR * 0.15, x, y, BR);
      g.addColorStop(0, 'rgba(255,255,255,.92)'); g.addColorStop(0.36, col); g.addColorStop(1, col);
      ctx.beginPath(); ctx.arc(x, y, BR, 0, 7); ctx.fillStyle = g; ctx.fill();
    }
    function numCircle(x, y, num) {
      ctx.beginPath(); ctx.arc(x, y, BR * 0.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.fillStyle = '#1b1b1b'; ctx.font = 'bold ' + Math.round(BR * 0.72) + 'px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('' + num, x, y + BR * 0.06);
    }
    function drawBall(b) {
      var x = b.x, y = b.y;
      if (b.type === 'cue') { shadeBall(x, y, '#fdfdfd'); }
      else if (b.type === 'stripe') {
        shadeBall(x, y, '#f7f5ee');
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, BR, 0, 7); ctx.clip();
        ctx.fillStyle = b.col; ctx.fillRect(x - BR, y - BR * 0.52, BR * 2, BR * 1.04); ctx.restore();
        numCircle(x, y, b.num);
      } else { shadeBall(x, y, b.col); numCircle(x, y, b.num); }
      ctx.beginPath(); ctx.arc(x, y, BR, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.3; ctx.stroke();
    }
    function render() {
      ctx.clearRect(0, 0, Wt, Ht);
      rr(1, 1, Wt - 2, Ht - 2, M * 0.7); ctx.fillStyle = '#5a3a22'; ctx.fill();
      rr(L, T, Rr - L, Bb - T, M * 0.25); ctx.fillStyle = '#2f7d4e'; ctx.fill();
      for (var pk = 0; pk < pockets.length; pk++) { ctx.beginPath(); ctx.arc(pockets[pk][0], pockets[pk][1], POCK, 0, 7); ctx.fillStyle = '#0b0b0b'; ctx.fill(); }
      for (var i = 0; i < balls.length; i++) if (!balls[i].potted) drawBall(balls[i]);
      var human = !(mode === 'ai' && cur === 1);
      if (ballInHand && human && !over) {
        var cbb = cueB(); ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cbb.x, cbb.y, BR + 3, 0, 7); ctx.stroke(); ctx.restore();
      }
      if (aiming && !moving() && !over && !ballInHand) {
        var cu = cueB(), dx = cu.x - aimX, dy = cu.y - aimY, d = Math.hypot(dx, dy);
        if (d > 4) {
          var pw = Math.min(d, maxPull) / maxPull;
          ctx.save(); ctx.setLineDash([6, 7]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)';
          ctx.beginPath(); ctx.moveTo(cu.x, cu.y); ctx.lineTo(cu.x + dx / d * (BR + pw * Wt * 0.9), cu.y + dy / d * (BR + pw * Wt * 0.9)); ctx.stroke();
          ctx.setLineDash([]); ctx.strokeStyle = 'rgba(230,180,90,.95)'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(cu.x - dx / d * BR * 1.4, cu.y - dy / d * BR * 1.4); ctx.lineTo(cu.x - dx / d * (BR * 1.4 + pw * Wt * 0.5), cu.y - dy / d * (BR * 1.4 + pw * Wt * 0.5)); ctx.stroke();
          ctx.restore();
        }
      }
    }
    function frame(t) {
      if (!running || !canvas.isConnected) return;
      if (!last) last = t; var dt = Math.min(0.045, (t - last) / 1000); last = t;
      var K = 4, sd = dt / K; for (var k = 0; k < K; k++) step(sd);   // sous-pas : collisions fiables
      render(); requestAnimationFrame(frame);
    }

    function pt(e) { var r = canvas.getBoundingClientRect(); var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top; return [x * Wt / r.width, y * Ht / r.height]; }
    function placeCue(q) { var cb = cueB(); cb.x = Math.max(L + BR, Math.min(Rr - BR, q[0])); cb.y = Math.max(T + BR, Math.min(Bb - BR, q[1])); }
    function cueValid() { var cb = cueB(); for (var i = 1; i < balls.length; i++) { var b = balls[i]; if (!b.potted && Math.hypot(cb.x - b.x, cb.y - b.y) < BR * 2) return false; } return true; }

    canvas.addEventListener('pointerdown', function (e) {
      if (over || moving() || phase !== 'aim') return;
      if (mode === 'ai' && cur === 1) return;
      var q = pt(e);
      if (ballInHand) { placing = true; placeCue(q); return; }
      aiming = true; aimX = q[0]; aimY = q[1];
    });
    canvas.addEventListener('pointermove', function (e) {
      var q = pt(e);
      if (placing) { placeCue(q); e.preventDefault(); return; }
      if (aiming) { aimX = q[0]; aimY = q[1]; e.preventDefault(); }
    }, { passive: false });
    window.addEventListener('pointerup', function () {
      if (placing) { placing = false; if (cueValid()) { ballInHand = false; msg = ''; setStatus(); } return; }
      if (!aiming) return; aiming = false;
      var cb = cueB(), dx = cb.x - aimX, dy = cb.y - aimY, d = Math.hypot(dx, dy);
      if (d > 6) shoot(dx, dy, Math.min(d, maxPull) / maxPull);
    });

    teardown = function () { running = false; };
    view.appendChild(modeSeg('ai', function (v) { mode = v; setup(); }));
    view.appendChild(status); view.appendChild(wrap);
    view.appendChild(E('p', 'bg-hint', 'Pleines (1-7) ou rayées (9-15), puis la 8 pour gagner. Tire la queue vers l’arrière depuis la blanche et relâche. Faute = bille en main pour l’adversaire.'));
    view.appendChild(newBtn(setup));
    setup();
    requestAnimationFrame(frame);
  }

  var GAMES = [
    { id: 'dames', name: 'Dames', icon: 'dames', desc: 'Le damier · ordi ou à deux', build: buildDames },
    { id: 'echecs', name: 'Échecs', icon: 'chess', desc: 'Ordi ou à deux', build: buildChess },
    { id: 'billard', name: 'Billard', icon: 'billard', desc: '8-ball · pleines/rayées · ordi ou à deux', build: buildBillard },
    { id: 'zuma', name: 'Zuma', icon: 'zuma', desc: 'Aligne 3 boules', build: buildZuma }
  ];

  window.BuubGames = { open: open, close: close };
})();
