'use strict';

/* ---------- Config ---------- */

// Rowers per team. To add or remove a rower, edit these lists.
// side: 'SB' (stuurboord) or 'BB' (bakboord) is the rower's usual side (shown as colour).
// The side printed in the message always comes from the seat they sit on.
// stroke: the side of the slag seat; the other seats alternate from there.
// lineup: the sample line-up shown on first open, from slag to boeg; everyone else is reserve.
// boot: the default bootnat time.
const TEAMS = {
  HCL8: {
    name: 'HCL8', size: 8, stroke: 'BB', boot: '11:00',
    lineup: ['Tom', 'Tobias', 'Ole', 'Stan', 'Tinco', 'Jesse', 'Gijs', 'Sebastiaan'],
    rowers: [
      ['Gijs', 'BB'], ['Jesse', 'SB'], ['Lasse', 'SB'], ['Louk', 'SB'], ['Martijn', 'SB'],
      ['Ole', 'BB'], ['Ruud', 'BB'], ['Sebastiaan', 'SB'], ['Stan', 'SB'], ['Tinco', 'BB'],
      ['Tobias', 'SB'], ['Tom', 'BB'], ['Casper', 'BB'],
    ],
  },
  DCL8: {
    name: 'DCL8', size: 8, stroke: 'SB', boot: '11:00',
    lineup: ['Mirthe', 'Tess', 'Nanna', 'Sofie', 'Iris', 'Milla', 'Sol', 'Sytske'],
    rowers: [
      ['Annemijn', 'SB'], ['Iris', 'SB'], ['Milla', 'BB'], ['Milou', 'BB'], ['Mirthe', 'SB'],
      ['Sofie', 'BB'], ['Sol', 'BB'], ['Sytske', 'BB'], ['Tess', 'BB'], ['Mathilde', 'SB'],
      ['Nanna', 'SB'],
    ],
  },
  'DCL4*': {
    name: 'DCL4*', size: 4, stroke: null, boot: '07:00', // scull: no sides
    lineup: ['Merel', 'Mette', 'Laila', 'Isabel'],
    rowers: [['Mette'], ['Anna'], ['Merel'], ['Isabel'], ['Jasmijn'], ['Laila']],
  },
};

const ERGO_BEFORE = 30; // minutes before bootnat
const VOOR_BEFORE = 15; // minutes before bootnat

const DAY_WORDS = ['vandaag', 'morgen', 'overmorgen'];
const STORAGE_KEY = 'opstellingen-v3';
const AUTH_KEY = 'opstellingen-auth';
const PASSCODE = '1966'; // Simple gate only; anyone reading the source can see it.

/* ---------- Pure helpers (also used by tests) ---------- */

function rostersOf(cfg) {
  return cfg.rowers.map(([name, side]) => ({ id: name, name, side: side || null }));
}

// Slag (seat = size) has cfg.stroke; sides alternate towards the boeg.
function seatSide(cfg, seat) {
  if (!cfg.stroke) return null;
  const other = cfg.stroke === 'SB' ? 'BB' : 'SB';
  return (cfg.size - seat) % 2 === 0 ? cfg.stroke : other;
}

// '07:00' minus 30 → '6:30' (no leading zero on the hour, as written in the messages).
function minusMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m - mins) % 1440) + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
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

function benchOf(team, cfg) {
  return rostersOf(cfg).filter((r) => !team.seats.includes(r.id));
}

function buildMessage(team, cfg, now) {
  const rowers = rostersOf(cfg);
  const byId = (id) => rowers.find((r) => r.id === id);
  const label = (team.label || '').trim() || 'boottraining';
  const date = formatLong(dayDate(team.day, now));
  const lines = [`De opstelling voor de ${label} van ${DAY_WORDS[team.day]}, ${date}:`, ''];

  for (let s = cfg.size; s >= 1; s--) {
    const r = byId(team.seats[s - 1]);
    let line = `${s} ${r ? r.name : '-'}`;
    if (r && cfg.stroke) line += ' ' + seatSide(cfg, s);
    if (s === cfg.size) line += ' (slag)';
    else if (s === 1) line += ' (boeg)';
    lines.push(line);
  }

  if (team.boot) {
    lines.push(
      '',
      `${minusMinutes(team.boot, ERGO_BEFORE)} ergo`,
      `${minusMinutes(team.boot, VOOR_BEFORE)} voorbespreken`,
      `${minusMinutes(team.boot, 0)} bootnat`,
    );
  }

  const subs = benchOf(team, cfg).map((r) => r.name);
  if (subs.length) lines.push('', 'Vervangende training:', subs.join(', '));

  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { TEAMS, seatSide, minusMinutes, buildMessage, benchOf };
}

/* ---------- App (browser only) ---------- */

if (typeof document !== 'undefined') {
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Sample line-up from the config; seats[i] is seat i+1, so reverse the slag→boeg list.
  function newTeam(cfg) {
    const seats = Array.from({ length: cfg.size }, (_, i) => (cfg.lineup || [])[cfg.size - 1 - i] || null);
    return { seats, day: 1, label: 'boottraining', boot: cfg.boot };
  }

  // Seats only keep rowers that are still in the roster in the code.
  function normTeam(k, raw) {
    const cfg = TEAMS[k];
    const t = Object.assign(newTeam(cfg), raw || {});
    const ids = new Set(rostersOf(cfg).map((r) => r.id));
    const seats = Array.isArray(t.seats) ? t.seats : [];
    t.seats = Array.from({ length: cfg.size }, (_, i) => (ids.has(seats[i]) ? seats[i] : null));
    if (![0, 1, 2].includes(t.day)) t.day = 1;
    if (!/^\d\d:\d\d$/.test(t.boot || '')) t.boot = cfg.boot;
    return t;
  }

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (!TEAMS[s.active]) s.active = 'HCL8';
    const teams = s.teams || {};
    s.teams = {};
    for (const k in TEAMS) s.teams[k] = normTeam(k, teams[k]);
    return s;
  }

  const state = load();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const team = () => state.teams[state.active];
  const cfg = () => TEAMS[state.active];
  const rowerById = (id) => rostersOf(cfg()).find((r) => r.id === id);

  let selected = null; // id of the rower picked by tapping, waiting for a destination

  function rowerHTML(r) {
    const cls = (r.side === 'SB' ? 'sb' : r.side === 'BB' ? 'bb' : 'multi') + (r.id === selected ? ' selected' : '');
    return `<div class="rower ${cls}"data-id="${esc(r.id)}"><span>${esc(r.name)}</span>${r.side ? `<span class="side">${r.side}</span>` : ''}</div>`;
  }

  /* ---------- Render ---------- */

  function render() {
    const c = cfg();
    const t = team();

    $('#tabs').innerHTML = Object.keys(TEAMS)
      .map((k) => `<button type="button" data-team="${esc(k)}" aria-pressed="${k === state.active}">${esc(k)}</button>`)
      .join('');

    document.body.classList.toggle('picking', !!selected);
    $('#boatTitle').textContent = `${c.name} · ${c.size} plekken`;
    $('#legend').hidden = !c.stroke;

    let boat = '';
    for (let s = c.size; s >= 1; s--) {
      const r = rowerById(t.seats[s - 1]);
      const tag = s === c.size ? 'slag' : s === 1 ? 'boeg' : '';
      const sub = [tag, seatSide(c, s)].filter(Boolean).join(' · ');
      boat += `<div class="seat" data-seat="${s - 1}">
        <div class="seat-no"><b>${s}</b><small>${sub || '&nbsp;'}</small></div>
        <div class="slot">${r ? rowerHTML(r) : '<span class="empty">Leeg</span>'}</div>
      </div>`;
    }
    $('#boat').innerHTML = boat;

    const bench = benchOf(t, c);
    $('#bench').innerHTML = bench.length
      ? bench.map(rowerHTML).join('')
      : '<span class="none">Geen reserves</span>';

    $('#days').innerHTML = DAY_WORDS.map((w, i) => `<button type="button" data-day="${i}" aria-pressed="${t.day === i}">
        <b>${w[0].toUpperCase() + w.slice(1)}</b><small>${formatShort(dayDate(i))}</small></button>`).join('');

    $('#labelInput').value = t.label;
    $('#tBoot').value = t.boot;

    renderMessage();
  }

  function renderMessage() {
    const t = team();
    $('#timesHint').textContent = t.boot
      ? `Ergo ${minusMinutes(t.boot, ERGO_BEFORE)} · Voorbespreken ${minusMinutes(t.boot, VOOR_BEFORE)}`
      : '';
    const msg = buildMessage(t, cfg());
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
    selected = null;
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

  const onBoot = (e) => {
    team().boot = e.target.value;
    save();
    renderMessage();
  };
  $('#tBoot').addEventListener('input', onBoot);
  $('#tBoot').addEventListener('change', onBoot);

  $('#clearBtn').addEventListener('click', () => {
    team().seats.fill(null);
    commit();
  });

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

  // to: a seat index, or 'bench'.
  function moveRower(id, to) {
    const seats = team().seats;
    const from = seats.indexOf(id);
    if (to === 'bench') {
      if (from >= 0) seats[from] = null;
      return;
    }
    if (to === from) return;
    const occupant = seats[to];
    seats[to] = id;
    // Swap with the occupant if we came from a seat; otherwise the occupant goes to the bench.
    if (from >= 0) seats[from] = occupant;
  }

  const targetOf = (el) => (el.hasAttribute('data-bench') ? 'bench' : +el.dataset.seat);

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
      if (selected) {
        selected = null;
        document.body.classList.remove('picking');
        document.querySelectorAll('.rower.selected').forEach((el) => el.classList.remove('selected'));
      }
      startDrag();
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }, { passive: false });

  document.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const { id, started, target } = drag;
    endDrag();
    if (!started) return; // a tap: handled by the click listener below
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (target) {
      moveRower(id, targetOf(target));
      commit();
    }
  });

  document.addEventListener('pointercancel', endDrag);

  /* ---------- Tap to move: tap a rower, then tap where they should go ---------- */

  let suppressClick = false; // ignore the click some browsers fire right after a drag

  document.addEventListener('click', (e) => {
    if (suppressClick) return;
    const rowerEl = e.target.closest('.rower');
    const spotEl = e.target.closest('[data-seat], [data-bench]');

    if (!selected) {
      if (rowerEl) {
        selected = rowerEl.dataset.id;
        render();
      }
      return;
    }

    const seats = team().seats;
    if (rowerEl && rowerEl.dataset.id !== selected) {
      const other = rowerEl.dataset.id;
      if (seats.includes(other)) {
        moveRower(selected, seats.indexOf(other)); // take their seat (swap, or they go to reserves)
      } else if (seats.includes(selected)) {
        moveRower(other, seats.indexOf(selected)); // reserve takes the selected rower's seat
      } else {
        selected = other; // both reserves: just switch the selection
        render();
        return;
      }
    } else if (!rowerEl && spotEl) {
      moveRower(selected, targetOf(spotEl));
    }
    // Tapping the same rower again, or anywhere else, cancels the selection.
    selected = null;
    commit();
  });

  /* ---------- Start ---------- */

  render();
  save();

  const gate = $('#gate');
  let authed = false;
  try { authed = localStorage.getItem(AUTH_KEY) === '1'; } catch (e) { authed = false; }
  if (authed) {
    gate.remove();
  } else {
    gate.hidden = false;
    $('#gateInput').focus();
    $('#gateForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if ($('#gateInput').value.trim() === PASSCODE) {
        try { localStorage.setItem(AUTH_KEY, '1'); } catch (err) { /* storage unavailable */ }
        gate.remove();
      } else {
        $('#gateInput').value = '';
        $('#gateMsg').hidden = false;
      }
    });
  }

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}
