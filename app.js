'use strict';

/* ---------- Config ---------- */

const TEAMS = {
  HCL8: { name: 'HCL8', size: 8, sides: true },
  DCL8: { name: 'DCL8', size: 8, sides: true },
  'DCL4*': { name: 'DCL4*', size: 4, sides: false },
};
const DAY_WORDS = ['vandaag', 'morgen', 'overmorgen'];
const STORAGE_KEY = 'opstellingen-v1';

/* ---------- Pure helpers (also used by tests) ---------- */

// In an eight, even seats row bakboord (BB), odd seats stuurboord (SB).
function seatSide(seat) {
  return seat % 2 === 0 ? 'BB' : 'SB';
}

function dayDate(offset, now) {
  const d = new Date(now || Date.now());
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function formatLong(d) {
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatShort(d) {
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function benchOf(team) {
  return team.rowers.filter((r) => !team.seats.includes(r.id));
}

function buildMessage(team, cfg, now) {
  const byId = (id) => team.rowers.find((r) => r.id === id);
  const label = (team.label || '').trim() || 'boottraining';
  const date = formatLong(dayDate(team.day, now));
  const lines = [`De opstelling voor de ${label} van ${DAY_WORDS[team.day]}, ${date}:`, ''];

  for (let s = cfg.size; s >= 1; s--) {
    const r = byId(team.seats[s - 1]);
    let line = `${s} ${r ? r.name : '-'}`;
    if (r && cfg.sides) line += ' ' + (r.side === 'X' ? seatSide(s) : r.side);
    if (s === cfg.size) line += ' (slag)';
    else if (s === 1) line += ' (boeg)';
    lines.push(line);
  }

  const t = team.times;
  const timeLines = [];
  if (t.ergo) timeLines.push(`${t.ergo} ergo`);
  if (t.voor) timeLines.push(`${t.voor} voorbespreken`);
  if (t.boot) timeLines.push(`${t.boot} bootnat`);
  if (timeLines.length) lines.push('', ...timeLines);

  const subs = benchOf(team).map((r) => r.name);
  if (subs.length) lines.push('', 'Vervangende training:', subs.join(', '));

  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { TEAMS, seatSide, buildMessage, benchOf };
}

/* ---------- App (browser only) ---------- */

if (typeof document !== 'undefined') {
  const $ = (sel) => document.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function newTeam(size) {
    return {
      rowers: [],
      seats: Array(size).fill(null),
      day: 1,
      label: 'boottraining',
      times: { ergo: '10:30', voor: '10:45', boot: '11:00' },
    };
  }

  function seed() {
    const s = { active: 'HCL8', teams: {} };
    for (const k in TEAMS) s.teams[k] = newTeam(TEAMS[k].size);
    const demo = [
      ['Sebastiaan', 'SB'], ['Gijs', 'BB'], ['Jesse', 'SB'], ['Tinco', 'BB'],
      ['Stan', 'SB'], ['Oli', 'BB'], ['Tobias', 'SB'], ['Tom', 'BB'],
      ['Martijn', 'X'], ['Lasse', 'X'], ['Louk', 'X'], ['Ruud', 'X'],
    ];
    const t = s.teams.HCL8;
    demo.forEach(([name, side], i) => {
      const r = { id: uid(), name, side };
      t.rowers.push(r);
      if (i < 8) t.seats[i] = r.id;
    });
    return s;
  }

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
    if (!s || !s.teams) return seed();
    if (!TEAMS[s.active]) s.active = 'HCL8';
    for (const k in TEAMS) {
      const size = TEAMS[k].size;
      const t = Object.assign(newTeam(size), s.teams[k] || {});
      t.times = Object.assign({ ergo: '', voor: '', boot: '' }, t.times);
      const ids = new Set(t.rowers.map((r) => r.id));
      t.seats = Array.from({ length: size }, (_, i) => (ids.has(t.seats[i]) ? t.seats[i] : null));
      if (![0, 1, 2].includes(t.day)) t.day = 1;
      s.teams[k] = t;
    }
    return s;
  }

  const state = load();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const team = () => state.teams[state.active];
  const cfg = () => TEAMS[state.active];
  const rowerById = (id) => team().rowers.find((r) => r.id === id);

  function colorClass(r) {
    if (!cfg().sides || r.side === 'X') return 'multi';
    return r.side === 'SB' ? 'sb' : 'bb';
  }

  function rowerHTML(r) {
    const side = cfg().sides ? (r.side === 'X' ? 'SB/BB' : r.side) : '';
    return `<div class="rower ${colorClass(r)}" data-id="${r.id}"><span>${esc(r.name)}</span>${side ? `<span class="side">${side}</span>` : ''}</div>`;
  }

  /* ---------- Render ---------- */

  function render() {
    const c = cfg();
    const t = team();

    $('#tabs').innerHTML = Object.keys(TEAMS)
      .map((k) => `<button type="button" data-team="${esc(k)}" aria-pressed="${k === state.active}">${esc(k)}</button>`)
      .join('');

    $('#boatTitle').textContent = `${c.name} · ${c.size} plekken`;
    $('#legend').hidden = !c.sides;

    let boat = '';
    for (let s = c.size; s >= 1; s--) {
      const r = rowerById(t.seats[s - 1]);
      const tag = s === c.size ? 'slag' : s === 1 ? 'boeg' : '';
      const sub = [tag, c.sides ? seatSide(s) : ''].filter(Boolean).join(' · ');
      boat += `<div class="seat" data-seat="${s - 1}">
        <div class="seat-no"><b>${s}</b><small>${sub || '&nbsp;'}</small></div>
        <div class="slot">${r ? rowerHTML(r) : '<span class="empty">Leeg</span>'}</div>
      </div>`;
    }
    $('#boat').innerHTML = boat;

    const bench = benchOf(t);
    $('#bench').innerHTML = bench.length
      ? bench.map(rowerHTML).join('')
      : '<span class="none">Geen reserves</span>';

    $('#days').innerHTML = DAY_WORDS.map((w, i) => `<button type="button" data-day="${i}" aria-pressed="${t.day === i}">
        <b>${w[0].toUpperCase() + w.slice(1)}</b><small>${formatShort(dayDate(i))}</small></button>`).join('');

    $('#labelInput').value = t.label;
    $('#tErgo').value = t.times.ergo;
    $('#tVoor').value = t.times.voor;
    $('#tBoot').value = t.times.boot;

    renderMessage();
  }

  function renderMessage() {
    const msg = buildMessage(team(), cfg());
    $('#preview').textContent = msg;
    $('#waBtn').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  }

  function commit() {
    save();
    render();
  }

  /* ---------- Controls ---------- */

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-team]');
    if (!b) return;
    state.active = b.dataset.team;
    commit();
  });

  $('#days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    team().day = +b.dataset.day;
    commit();
  });

  $('#labelInput').addEventListener('input', (e) => {
    team().label = e.target.value;
    save();
    renderMessage();
  });

  [['#tErgo', 'ergo'], ['#tVoor', 'voor'], ['#tBoot', 'boot']].forEach(([sel, key]) => {
    const onChange = (e) => {
      team().times[key] = e.target.value;
      save();
      renderMessage();
    };
    $(sel).addEventListener('input', onChange);
    $(sel).addEventListener('change', onChange);
  });

  $('#clearBtn').addEventListener('click', () => {
    team().seats.fill(null);
    commit();
  });

  $('#addBtn').addEventListener('click', () => openEditor(null));

  // Refresh dates when coming back to the app (e.g. the next day).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });

  /* ---------- Copy ---------- */

  let toastTimer = 0;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  $('#copyBtn').addEventListener('click', async () => {
    const text = buildMessage(team(), cfg());
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      ok = fallbackCopy(text);
    }
    toast(ok ? 'Gekopieerd ✓' : 'Kopiëren mislukt');
  });

  /* ---------- Drag & drop (touch + mouse via Pointer Events) ---------- */

  let drag = null;

  function dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('[data-seat], [data-bench]') : null;
  }

  function setOver(target) {
    if (drag.target === target) return;
    if (drag.target) drag.target.classList.remove('over');
    drag.target = target;
    if (target) target.classList.add('over');
  }

  function startDrag() {
    const rect = drag.el.getBoundingClientRect();
    const ghost = drag.el.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.offX = drag.x0 - rect.left;
    drag.offY = drag.y0 - rect.top;
    drag.started = true;
    drag.el.classList.add('placeholder');
    document.body.classList.add('dragging');
    requestAnimationFrame(autoScroll);
  }

  function moveDrag(x, y) {
    drag.x = x;
    drag.y = y;
    drag.ghost.style.transform = `translate(${x - drag.offX}px, ${y - drag.offY}px) scale(1.04)`;
    setOver(dropTargetAt(x, y));
  }

  // Scroll the page when the finger is near the top or bottom edge.
  function autoScroll() {
    if (!drag || !drag.started) return;
    const top = 80;
    const bottom = window.innerHeight - 140;
    let dy = 0;
    if (drag.y < top) dy = -Math.ceil((top - drag.y) / 5);
    else if (drag.y > bottom) dy = Math.ceil((drag.y - bottom) / 5);
    if (dy) {
      window.scrollBy(0, dy);
      setOver(dropTargetAt(drag.x, drag.y));
    }
    requestAnimationFrame(autoScroll);
  }

  function endDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.target) drag.target.classList.remove('over');
    drag.el.classList.remove('placeholder');
    document.body.classList.remove('dragging');
    drag = null;
  }

  function dropRower(id, target) {
    const seats = team().seats;
    const from = seats.indexOf(id);
    if (target.hasAttribute('data-bench')) {
      if (from >= 0) seats[from] = null;
      return;
    }
    const to = +target.dataset.seat;
    if (to === from) return;
    const occupant = seats[to];
    seats[to] = id;
    // Swap with the occupant if we came from a seat; otherwise the occupant goes to the bench.
    if (from >= 0) seats[from] = occupant;
  }

  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.rower');
    if (!el || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: el.dataset.id, el, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, started: false, target: null };
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.started) {
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (dx * dx + dy * dy < 49) return;
      startDrag();
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }, { passive: false });

  document.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const { id, started, target } = drag;
    endDrag();
    if (!started) {
      openEditor(id);
    } else if (target) {
      dropRower(id, target);
      commit();
    }
  });

  document.addEventListener('pointercancel', endDrag);

  /* ---------- Rower editor ---------- */

  const dlg = $('#editor');
  const nameInput = $('#nameInput');
  let editing = null;

  function paintSidePick() {
    document.querySelectorAll('#sidePick button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.side === editing.side));
    });
  }

  function openEditor(id) {
    const r = id ? rowerById(id) : null;
    const lastSide = editing && !id ? editing.side : 'SB';
    editing = { id, side: r ? r.side : cfg().sides ? lastSide : 'X' };
    $('#editTitle').textContent = r ? 'Roeier wijzigen' : `Roeier toevoegen · ${cfg().name}`;
    nameInput.value = r ? r.name : '';
    $('#sidePick').hidden = !cfg().sides;
    $('#delBtn').hidden = !r;
    $('#saveNextBtn').hidden = !!r;
    paintSidePick();
    if (!dlg.open) dlg.showModal();
    if (!r) nameInput.focus();
  }

  function saveEditor() {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return false;
    }
    if (editing.id) {
      const r = rowerById(editing.id);
      r.name = name;
      r.side = editing.side;
    } else {
      team().rowers.push({ id: uid(), name, side: editing.side });
    }
    commit();
    return true;
  }

  $('#sidePick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-side]');
    if (!b) return;
    editing.side = b.dataset.side;
    paintSidePick();
  });

  $('#editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (saveEditor()) dlg.close();
  });

  $('#saveNextBtn').addEventListener('click', () => {
    if (saveEditor()) {
      toast(`${nameInput.value.trim()} toegevoegd`);
      openEditor(null);
    }
  });

  $('#cancelBtn').addEventListener('click', () => dlg.close());

  $('#delBtn').addEventListener('click', () => {
    const r = rowerById(editing.id);
    if (!r || !confirm(`${r.name} verwijderen?`)) return;
    const t = team();
    t.rowers = t.rowers.filter((x) => x.id !== r.id);
    t.seats = t.seats.map((s) => (s === r.id ? null : s));
    dlg.close();
    commit();
  });

  // Tap outside the dialog closes it.
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });

  /* ---------- Start ---------- */

  render();
  save();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}
