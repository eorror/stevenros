/* Desk · personal operating system. Everything lives in this browser (localStorage). */
'use strict';
(() => {

const KEY = 'desk.v1';
const PAGES = ['today', 'tasks', 'calendar', 'mail', 'money', 'settings'];
const DEFAULT_AREAS = [
  { name: 'MHQ', color: '#2F5BD8' }, { name: 'Partly', color: '' }, { name: 'Photogear', color: '#C98A12' },
  { name: 'ESA', color: '#2E8B57' }, { name: 'Channel', color: '#7A4FD0' }, { name: 'SAE', color: '#1E8C8C' },
  { name: 'Personal', color: '#B0577A' },
];

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayDiff = (a, b) => Math.round((sod(b) - sod(a)) / 864e5);
const today = () => sod(new Date());
const todayStr = () => ymd(new Date());
const mondayOf = d => addDays(sod(d), -((d.getDay() + 6) % 7));
const fmtDM = d => `${d.getDate()} ${MON[d.getMonth()]}`;
const fmtDDM = d => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
const fmt12 = d => `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hrs = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h + (m || 0) / 60; };
const tShort = t => { const [h, m] = t.split(':'); return `${+h}:${m}`; };
const at = (dateStr, t) => { const d = fromYmd(dateStr); const [h, m] = (t || '00:00').split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
const money = n => '$' + Math.abs(n).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = n => (n >= 0 ? '+' : '−') + money(n);
const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;
const okColor = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '';

/* ---------- state ---------- */
function fresh() {
  return { v: 1, name: '', welcomed: false, theme: 'system', accent: 'Vermilion', areas: DEFAULT_AREAS.map(a => ({ ...a })),
    todos: [], ideas: [], events: [], mail: [], entries: [], recurring: [], reviewed: {} };
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...fresh(), ...JSON.parse(raw) }; } catch (e) { /* ignore */ }
  return fresh();
}
let state = load();
let saveFailed = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); saveFailed = false; }
  catch (e) { if (!saveFailed) { saveFailed = true; toast('Could not save. Your browser storage may be full or blocked.'); } }
}
const snapshot = () => JSON.stringify(state);

const ui = {
  page: 'today', taskArea: 'All', mailArea: 'All', mailSel: null, mailOpen: false, moneyTab: 'All',
  monthOff: 0, calDate: today(), calView: null, calScrolled: false,
  capType: 'task', capArea: null, modal: null, toast: null,
};

/* ---------- areas ---------- */
const areaNames = () => state.areas.map(a => a.name);
const areaOf = n => state.areas.find(a => a.name === n);
const firstArea = () => (state.areas[0] && state.areas[0].name) || 'Personal';
function areaVars(n) {
  const a = areaOf(n);
  if (!a) return '--c:var(--ink3);--tb:color-mix(in oklch, var(--ink) 8%, transparent)';
  if (!a.color) return '--c:var(--ink2);--tb:color-mix(in oklch, var(--ink) 8%, transparent)';
  return `--c:${a.color};--tb:color-mix(in oklch, ${a.color} 14%, transparent)`;
}
const tagHtml = n => `<span class="tag" style="${areaVars(n)}"><span class="dot"></span>${esc(n)}</span>`;
const areaOptions = sel => areaNames().map(n => `<option value="${esc(n)}"${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');

/* ---------- icons ---------- */
const ic = (p, o = {}) => `<svg width="${o.s || 16}" height="${o.s || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${o.w || 1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  today: ic('<path d="M3.5 10.5 12 3.5l8.5 7V20h-5.5v-6h-6v6H3.5z"/>'),
  tasks: ic('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>'),
  calendar: ic('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  mail: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
  money: ic('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  settings: ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  moon: ic('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sun: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>', { w: 1.8 }),
  search: ic('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  back: ic('<path d="m15 5-7 7 7 7"/>', { w: 1.8 }),
  check: ic('<path d="m5 12 5 5 9-10"/>', { s: 12, w: 3 }),
};

/* ---------- to-dos ---------- */
function dueLabel(t) {
  if (!t.due) return 'No date';
  const d = fromYmd(t.due), n = dayDiff(today(), d);
  if (n < 0) return 'Overdue · ' + fmtDM(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return fmtDDM(d);
  return d.getFullYear() === today().getFullYear() ? fmtDDM(d) : `${fmtDM(d)} ${d.getFullYear()}`;
}
const isLate = t => !t.done && t.due && t.due < todayStr();
const visibleTodo = t => !t.done || t.doneOn === todayStr();
function todoGroup(t) {
  if (!t.due) return 'later';
  const n = dayDiff(today(), fromYmd(t.due));
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  const toSunday = (7 - today().getDay()) % 7;
  return n <= toSunday ? 'week' : 'later';
}
const sortTodos = (a, b) => (a.done - b.done) || ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0) || (a.created || 0) - (b.created || 0);
function todoRow(t) {
  return `<div class="todo${t.done ? ' done' : ''}">
    <button class="check${t.done ? ' on' : ''}" data-act="toggleTodo" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Complete'}">${I.check}</button>
    <button class="title" data-act="editTodo" data-id="${t.id}">${esc(t.title)}</button>
    ${tagHtml(t.area)}
    <span class="due num${isLate(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>
  </div>`;
}

/* ---------- money ---------- */
function occurrences(r, y, m) {
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const start = r.start ? fromYmd(r.start) : new Date(2000, 0, 1);
  const end = r.end ? fromYmd(r.end) : null;
  const out = [];
  if (r.freq === 'monthly') out.push(new Date(y, m, Math.min(r.day || start.getDate(), last.getDate())));
  else {
    const step = r.freq === 'weekly' ? 7 : 14;
    let d = new Date(start);
    const gap = dayDiff(d, first);
    if (gap > 0) d = addDays(d, Math.ceil(gap / step) * step);
    for (; d <= last; d = addDays(d, step)) out.push(new Date(d));
  }
  return out.filter(d => d >= start && (!end || d <= end) && d >= first && d <= last);
}
function nextOccurrence(r) {
  const t = today();
  for (let k = 0; k < 14; k++) {
    const y = t.getFullYear(), m = t.getMonth() + k;
    const hit = occurrences(r, new Date(y, m, 1).getFullYear(), new Date(y, m, 1).getMonth()).find(d => d >= t);
    if (hit) return hit;
  }
  return null;
}
const perMonth = r => Math.abs(r.amount) * (r.freq === 'weekly' ? 52 / 12 : r.freq === 'fortnightly' ? 26 / 12 : 1);
const activeRec = r => !r.end || r.end >= todayStr();
function ledger(y, m) {
  const rows = [];
  state.entries.forEach(e => { const d = fromYmd(e.date); if (d.getFullYear() === y && d.getMonth() === m) rows.push({ ...e, d, src: 'entry' }); });
  state.recurring.forEach(r => occurrences(r, y, m).forEach(d => rows.push({ ...r, d, src: 'rec' })));
  return rows.sort((a, b) => a.d - b.d || b.amount - a.amount);
}
function monthStats(y, m) {
  const rows = ledger(y, m), t = today();
  const sum = a => a.reduce((s, r) => s + r.amount, 0);
  const ins = rows.filter(r => r.amount > 0), outs = rows.filter(r => r.amount < 0);
  const inGot = sum(ins.filter(r => r.d < t)), inAll = sum(ins);
  const outGot = -sum(outs.filter(r => r.d < t)), outAll = -sum(outs);
  return { rows, inGot, inAll, outGot, outAll, net: inAll - outAll };
}
const viewMonth = () => { const t = today(); const d = new Date(t.getFullYear(), t.getMonth() + ui.monthOff, 1); return [d.getFullYear(), d.getMonth()]; };

/* ---------- mail ---------- */
const mailWaiting = () => state.mail.filter(m => !m.snooze || new Date(m.snooze) <= new Date());
const mailSnoozed = () => state.mail.filter(m => m.snooze && new Date(m.snooze) > new Date());
function age(iso) {
  const mins = Math.max(0, (Date.now() - new Date(iso)) / 6e4);
  if (mins < 1) return 'now';
  if (mins < 60) return Math.floor(mins) + ' min';
  if (mins < 1440) return Math.floor(mins / 60) + ' h';
  if (mins < 10080) return Math.floor(mins / 1440) + ' d';
  return Math.floor(mins / 10080) + ' w';
}
const paras = s => String(s || '').split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean);
const mailRow = (m, on) => `<button class="mrow${on ? ' on' : ''}" data-act="openMail" data-id="${m.id}" style="${areaVars(m.area)}">
  <span class="top"><span class="dot"></span><span class="from">${esc(m.from)}${m.org ? ' · ' + esc(m.org) : ''}</span>${m.draft ? '<span class="pill">Draft ready</span>' : ''}<span class="age num">${age(m.added)}</span></span>
  <span class="subj">${esc(m.subject || '(no subject)')}</span>
  ${m.body ? `<span class="snip">${esc(paras(m.body).join(' '))}</span>` : ''}
</button>`;

/* ---------- events ---------- */
const evStart = e => at(e.date, e.allDay ? '00:00' : e.start);
const evEnd = e => e.allDay ? addDays(fromYmd(e.date), 1) : at(e.date, e.end || e.start);
const eventsOn = ds => state.events.filter(e => e.date === ds);
function upcoming(n) {
  const now = new Date();
  return state.events.filter(e => !e.allDay && evEnd(e) > now).sort((a, b) => evStart(a) - evStart(b)).slice(0, n);
}
function relLabel(e) {
  const now = new Date(), s = evStart(e), mins = Math.round((s - now) / 6e4);
  if (s <= now) return ['Now', true];
  const dd = dayDiff(now, s);
  if (dd === 0 && mins < 180) return ['In ' + (mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`), true];
  if (dd === 0) return [fmt12(s), false];
  if (dd === 1) return ['Tomorrow ' + fmt12(s), false];
  return [fmtDDM(s), false];
}

/* ---------- toast + undo ---------- */
let toastTimer;
function toast(msg, undo) {
  ui.toast = { msg, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; renderToast(); }, undo ? 5000 : 2600);
  renderToast();
}
function renderToast() {
  const host = $('#toast');
  const onToday = ui.page === 'today' && !ui.modal && !isMobile() && $('#caphint');
  const t = ui.toast;
  const inner = t ? `<span>${esc(t.msg)}</span>${t.undo ? '<button data-act="undo">Undo</button>' : ''}` : '';
  if (onToday) { $('#caphint').innerHTML = inner; host.innerHTML = ''; return; }
  host.innerHTML = t ? `<div class="toast" role="status">${inner}</div>` : '';
}
function change(fn, msg, undoable) {
  const snap = undoable ? snapshot() : null;
  fn();
  save(); render();
  if (msg) toast(msg, snap);
}

/* ---------- render: shell ---------- */
function navBtn(k, label, count) {
  return `<button class="nav${ui.page === k ? ' on' : ''}" data-act="go" data-page="${k}">${I[k]}<span>${label}</span>${count ? `<span class="count num">${count}</span>` : ''}</button>`;
}
function sidebar() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<aside class="side">
    <div class="brand"><div class="mark">D</div><div class="name">Desk</div><div class="who">${esc(state.name)}</div></div>
    <div class="side-actions">
      <button class="capbtn" data-act="capture">${I.plus}<span>Quick capture</span><span class="kbd">⌘K</span></button>
      <button class="searchbtn" data-act="search">${I.search}<span>Search</span><span class="kbd">⌘/</span></button>
    </div>
    <nav class="navlist">
      ${navBtn('today', 'Today')}
      ${navBtn('tasks', 'Ideas &amp; to-dos', state.ideas.length ? state.ideas.length + ' inbox' : '')}
      ${navBtn('calendar', 'Calendar')}
      ${navBtn('mail', 'Mail', mailWaiting().length ? mailWaiting().length + ' waiting' : '')}
      ${navBtn('money', 'Money')}
    </nav>
    <div class="navlist">
      <div class="side-label">Areas</div>
      ${state.areas.map(a => `<button class="nav area" data-act="areaGo" data-area="${esc(a.name)}" style="${areaVars(a.name)}"><span class="sq"></span>${esc(a.name)}</button>`).join('')}
    </div>
    <div class="side-foot">
      <button class="nav" data-act="toggleTheme">${dark ? I.sun : I.moon}<span>${dark ? 'Light mode' : 'Dark mode'}</span></button>
      ${navBtn('settings', 'Settings')}
    </div>
  </aside>`;
}
function tabbar() {
  const t = (k, l) => `<button class="${ui.page === k ? 'on' : ''}" data-act="go" data-page="${k}">${I[k]}${l}</button>`;
  return `<nav class="tabbar">${t('today', 'Today')}${t('tasks', 'To-dos')}${t('calendar', 'Calendar')}${t('mail', 'Mail')}${t('money', 'Money')}</nav>`;
}
function mobileTop() {
  return `<div class="mtop only-mobile">
    <button class="btn ghost" data-act="search" aria-label="Search">${I.search}</button>
    <button class="btn ghost" data-act="toggleTheme" aria-label="Theme">${document.documentElement.dataset.theme === 'dark' ? I.sun : I.moon}</button>
    <button class="btn ghost" data-act="go" data-page="settings" aria-label="Settings">${I.settings}</button>
  </div>`;
}

/* ---------- page: today ---------- */
function pageToday() {
  const now = new Date(), h = now.getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = state.name ? ', ' + esc(state.name) : '';
  const evToday = state.events.filter(e => e.date === todayStr()).length;
  const todayTodos = state.todos.filter(t => visibleTodo(t) && ['overdue', 'today'].includes(todoGroup(t))).sort(sortTodos);
  const shown = todayTodos.slice(0, 7);
  const doneN = todayTodos.filter(t => t.done).length;
  const waiting = mailWaiting();
  const [y, m] = [now.getFullYear(), now.getMonth()];
  const st = monthStats(y, m);
  const capArea = ui.capArea && areaOf(ui.capArea) ? ui.capArea : firstArea();
  const next = upcoming(3);

  const counts = {};
  waiting.forEach(x => { counts[x.area] = (counts[x.area] || 0) + 1; });
  const topCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const latest = waiting.slice().sort((a, b) => new Date(b.added) - new Date(a.added)).slice(0, 3);
  const drafts = waiting.filter(x => x.draft).length;

  const welcome = !state.welcomed ? `<div class="card welcome">
      <h2>Welcome to Desk</h2>
      <p>Ideas, to-dos, calendar, mail you owe a reply and money, in one place. Everything you add stays in this browser on this device. Back it up from Settings.</p>
      <div class="acts">
        <input class="input" id="welcomeName" placeholder="Your first name" value="${esc(state.name)}" autocomplete="given-name">
        <button class="btn ink" data-act="welcomeStart">Start fresh</button>
        <button class="btn" data-act="welcomeSample">Try it with sample data</button>
      </div>
    </div>` : '';

  return `<div class="page">
    <header class="phead">
      <div class="titles">
        <div class="eyebrow num">${DOWL[now.getDay()]} ${now.getDate()} ${MON[m]} ${y} · ${fmt12(now)}</div>
        <h1>${hello}${name}</h1>
      </div>
      <div class="aside num">${plural(evToday, 'event')} · ${plural(todayTodos.filter(t => !t.done).length, 'to-do')} · ${plural(waiting.length, 'email')}</div>
    </header>
    ${welcome}
    <div class="capwrap only-desktop">
      <div class="capbar">
        ${I.plus}
        <input id="cap" placeholder="Capture a thought or a to-do…" autocomplete="off" aria-label="Capture">
        <div class="seg"><button class="${ui.capType === 'task' ? 'on' : ''}" data-act="capType" data-v="task">Task</button><button class="${ui.capType === 'idea' ? 'on' : ''}" data-act="capType" data-v="idea">Idea</button></div>
        <select class="sel" id="capArea" aria-label="Area">${areaOptions(capArea)}</select>
        <button class="btn ink" data-act="capSave" style="height:34px">Add <span class="kh">↵</span></button>
      </div>
      <div class="caphint"><span class="msg" id="caphint"></span><span class="nowrap">Press <span class="k">⌘K</span> from anywhere · <span class="k">Tab</span> switches Task / Idea</span></div>
    </div>
    <button class="capfake only-mobile" data-act="capture">${I.plus}<span class="ph">Capture…</span><span class="pill">Task</span></button>

    <div class="grid2">
      <div class="col">
        <div class="card">
          <div class="card-h"><span class="t">Next up</span><button class="link only-desktop" data-act="go" data-page="calendar">Open calendar →</button></div>
          <div class="rows">${next.length ? next.map(e => {
            const [rel, soon] = relLabel(e);
            return `<div class="ev" data-act="editEvent" data-id="${e.id}" style="${areaVars(e.area)}">
              <div class="when num"><b>${tShort(e.start)}</b><span>to ${tShort(e.end || e.start)}</span></div>
              <div class="what"><b>${esc(e.title)}</b>${e.where ? `<span class="where">${esc(e.where)}</span>` : ''}<span class="only-mobile">${esc(e.area)} · ${esc(rel)}</span></div>
              <div class="right">${tagHtml(e.area)}<span class="rel${soon ? ' soon' : ''}">${esc(rel)}</span></div>
            </div>`;
          }).join('') : `<div class="empty">Nothing coming up.<br><button class="btn sm" data-act="newEvent">Add an event</button></div>`}</div>
        </div>
        <div class="card">
          <div class="card-h"><span class="lead"><span class="t">Due today &amp; overdue</span><span class="meta num">${todayTodos.length ? `${doneN} of ${todayTodos.length} done` : ''}</span></span><button class="link only-desktop" data-act="go" data-page="tasks">All to-dos →</button></div>
          <div class="rows">${shown.length ? shown.map(todoRow).join('') : `<div class="empty">Nothing due today.</div>`}</div>
          ${todayTodos.length > shown.length ? `<button class="more" data-act="go" data-page="tasks">${todayTodos.length - shown.length} more →</button>` : ''}
        </div>
      </div>
      <div class="card only-desktop">
        <div class="card-h"><span class="lead"><span class="t">Waiting on you</span><span class="meta num">${plural(waiting.length, 'email')}</span></span><button class="link" data-act="go" data-page="mail">Mail →</button></div>
        ${topCounts.length ? `<div class="mcounts">${topCounts.map(([a, n]) => `<div style="${areaVars(a)}"><b class="num">${n}</b><span><span class="dot"></span>${esc(a)}</span></div>`).join('')}</div>` : ''}
        <div class="rows">${latest.length ? latest.map(x => mailRow(x)).join('') : `<div class="empty">Nothing waiting on you.</div>`}</div>
        <div class="card-f">${waiting.length ? `Drafts ready for ${drafts} of these. ` : ''}Nothing sends without you.</div>
      </div>
    </div>

    <div class="card strip only-desktop">
      <div class="cell"><span class="l">In · ${MONL[m]}</span><span class="v">${money(st.inGot)}</span><span class="s">of ${money(st.inAll)} expected</span></div>
      <div class="cell"><span class="l">Out · ${MONL[m]}</span><span class="v">${money(st.outGot)}</span><span class="s">${money(st.outAll - st.outGot)} still to come</span></div>
      <div class="cell"><span class="l">Left at month end</span><span class="v">${st.net < 0 ? '−' : ''}${money(st.net)}</span><span class="s">Before day-to-day spending</span></div>
      <button class="go" data-act="go" data-page="money">Money →</button>
    </div>
    <div class="tiles only-mobile">
      <button class="tile" data-act="go" data-page="mail"><span class="l">Mail waiting</span><span class="v">${waiting.length}</span><span class="s">${topCounts.slice(0, 2).map(([a, n]) => `${esc(a)} ${n}`).join(' · ')}${topCounts.length > 2 ? ` · +${waiting.length - topCounts.slice(0, 2).reduce((s, x) => s + x[1], 0)}` : ''}</span></button>
      <button class="tile" data-act="go" data-page="money"><span class="l">Left this month</span><span class="v">${st.net < 0 ? '−' : ''}${money(st.net)}</span><span class="s">In ${money(st.inAll)} · out ${money(st.outAll)}</span></button>
    </div>
  </div>`;
}

/* ---------- page: ideas & to-dos ---------- */
function pageTasks() {
  const match = a => ui.taskArea === 'All' || ui.taskArea === a;
  const t0 = today();
  const groups = [['overdue', 'Overdue'], ['today', `Today · ${fmtDDM(t0)}`], ['week', 'This week'], ['later', 'Later']]
    .map(([g, label]) => {
      const items = state.todos.filter(t => visibleTodo(t) && match(t.area) && todoGroup(t) === g).sort(sortTodos);
      return { g, label, items };
    }).filter(x => x.items.length);
  const ideas = state.ideas.filter(i => match(i.area)).sort((a, b) => (b.created || 0) - (a.created || 0));
  const open = state.todos.filter(t => !t.done).length;
  const chips = ['All', ...areaNames()].map(n => `<button class="chip${ui.taskArea === n ? ' on' : ''}" data-act="taskArea" data-area="${esc(n)}" style="${n === 'All' ? '' : areaVars(n)}">${n === 'All' ? '' : '<span class="sq"></span>'}${esc(n)}</button>`).join('');
  return `<div class="page">
    <header class="phead">
      <div class="titles"><div class="eyebrow num">${plural(open, 'open to-do')} · ${plural(state.ideas.length, 'idea')} in inbox</div><h1>Ideas &amp; to-dos</h1></div>
      <button class="btn ink" data-act="newItem">New</button>
    </header>
    <div class="chips">${chips}</div>
    <div class="grid2 g15">
      <div class="col">
        ${groups.map(x => `<div class="card">
          <div class="card-h"><span class="t">${esc(x.label)}</span><span class="meta num">${x.items.filter(t => !t.done).length} open</span></div>
          <div class="rows">${x.items.map(todoRow).join('')}</div>
        </div>`).join('') || `<div class="card empty">${ui.taskArea === 'All' ? 'No to-dos yet. Capture one with ⌘K.' : 'No to-dos in this area.'}</div>`}
        ${state.todos.some(t => t.done) ? `<div><button class="btn ghost sm" data-act="clearDone">Clear completed to-dos</button></div>` : ''}
      </div>
      <div class="card">
        <div class="card-h"><span class="t">Ideas inbox</span><span class="meta">Promote the ones worth doing</span></div>
        <div class="rows">${ideas.length ? ideas.map(i => `<div class="idea">
          <button class="text" data-act="editIdea" data-id="${i.id}">${esc(i.text)}</button>
          <div class="meta">${tagHtml(i.area)}<span class="muted nowrap" style="font-size:12px">${i.created ? (dayDiff(new Date(i.created), today()) === 0 ? 'Today' : dayDiff(new Date(i.created), today()) === 1 ? 'Yesterday' : age(new Date(i.created).toISOString())) : ''}</span>
            <div class="acts"><button class="btn ghost sm" data-act="archiveIdea" data-id="${i.id}">Archive</button><button class="btn sm" style="background:var(--bg)" data-act="promoteIdea" data-id="${i.id}">Make to-do</button></div>
          </div>
        </div>`).join('') : `<div class="empty">Inbox clear.</div>`}</div>
      </div>
    </div>
  </div>`;
}

/* ---------- page: calendar ---------- */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
function layoutDay(evs) {
  const items = evs.map(e => { const s = hrs(e.start); return { e, s, en: Math.max(e.end === '24:00' ? 24 : hrs(e.end), s + 0.33) }; })
    .sort((a, b) => a.s - b.s || b.en - a.en);
  const out = []; let cluster = [], cEnd = -1;
  const flush = () => {
    const cols = [];
    cluster.forEach(it => { let c = cols.findIndex(end => end <= it.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = it.en; it.col = c; });
    cluster.forEach(it => { it.n = cols.length; out.push(it); });
    cluster = [];
  };
  items.forEach(it => { if (cluster.length && it.s >= cEnd) { flush(); cEnd = -1; } cluster.push(it); cEnd = Math.max(cEnd, it.en); });
  if (cluster.length) flush();
  return out;
}
const calView = () => ui.calView || (matchMedia('(max-width: 760px)').matches ? 'day' : 'week');
function pageCalendar() {
  const view = calView();
  const start = view === 'week' ? mondayOf(ui.calDate) : sod(ui.calDate);
  const days = Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => addDays(start, i));
  const last = days[days.length - 1];
  const label = view === 'week'
    ? `${fmtDM(days[0])}${days[0].getFullYear() !== last.getFullYear() ? ' ' + days[0].getFullYear() : ''} – ${fmtDM(last)} ${last.getFullYear()} · week ${isoWeek(days[0])}`
    : `${DOWL[start.getDay()]} ${fmtDM(start)} ${start.getFullYear()}`;
  const ts = todayStr(), now = new Date();
  const H = 52;
  const hasAllDay = days.some(d => eventsOn(ymd(d)).some(e => e.allDay));
  return `<div class="calpage">
    <header class="phead">
      <div class="titles"><div class="eyebrow num">${label}</div><h1>Calendar</h1></div>
      <div class="tools">
        <button class="btn sq32" data-act="calMove" data-n="-1" aria-label="Previous">‹</button>
        <button class="btn" data-act="calToday">Today</button>
        <button class="btn sq32" data-act="calMove" data-n="1" aria-label="Next">›</button>
        <div class="seg" style="background:var(--surface);margin-left:8px"><button class="${view === 'day' ? 'on' : ''}" data-act="calView" data-v="day">Day</button><button class="${view === 'week' ? 'on' : ''}" data-act="calView" data-v="week">Week</button></div>
        <button class="btn ink" data-act="newEvent">New event</button>
      </div>
    </header>
    <div class="card calcard" style="--n:${days.length}">
      <div class="calhead"><div></div>${days.map(d => `<div class="d${ymd(d) === ts ? ' today' : ''}"><span class="dow">${DOW[d.getDay()]}</span><span class="n">${d.getDate()}</span></div>`).join('')}</div>
      ${hasAllDay ? `<div class="calallday"><div class="gut">all day</div>${days.map(d => `<div class="d">${eventsOn(ymd(d)).filter(e => e.allDay).map(e => `<button class="adev" style="${areaVars(e.area)}" data-act="editEvent" data-id="${e.id}">${esc(e.title)}</button>`).join('')}</div>`).join('')}</div>` : ''}
      <div class="calscroll" id="calscroll">
        <div class="calgrid">
          <div class="gut">${Array.from({ length: 23 }, (_, k) => `<span style="top:${(k + 1) * H}px">${k + 1}:00</span>`).join('')}</div>
          ${days.map(d => {
            const ds = ymd(d);
            const evs = layoutDay(eventsOn(ds).filter(e => !e.allDay));
            const nowTop = ds === ts ? (now.getHours() + now.getMinutes() / 60) * H : null;
            return `<div class="day${ds === ts ? ' today' : ''}" data-act="slot" data-date="${ds}">
              ${evs.map(it => `<button class="cev" data-act="editEvent" data-id="${it.e.id}" style="${areaVars(it.e.area)};top:${it.s * H + 2}px;height:${Math.max((it.en - it.s) * H - 4, 18)}px;left:calc(4px + (100% - 8px) * ${it.col} / ${it.n});width:calc((100% - 8px) / ${it.n} - 2px)">
                <b>${esc(it.e.title)}</b><span>${tShort(it.e.start)}–${tShort(it.e.end || it.e.start)}</span></button>`).join('')}
              ${nowTop != null ? `<div class="nowline" style="top:${nowTop}px"></div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- page: mail ---------- */
function pageMail() {
  const showSnoozed = ui.mailArea === '__snoozed';
  const base = showSnoozed ? mailSnoozed() : mailWaiting();
  const waiting = mailWaiting();
  const list = base.filter(m => showSnoozed || ui.mailArea === 'All' || m.area === ui.mailArea)
    .sort((a, b) => new Date(b.added) - new Date(a.added));
  const cur = list.find(m => m.id === ui.mailSel) || (matchMedia('(max-width: 760px)').matches ? null : list[0]);
  const areasWithMail = areaNames().filter(a => waiting.some(m => m.area === a));
  const filt = (key, name, n, dot) => `<button class="nav${ui.mailArea === key ? ' on' : ''}" data-act="mailArea" data-area="${esc(key)}" ${dot ? `style="${areaVars(key)}"` : ''}>${dot ? '<span class="sq"></span>' : ''}${esc(name)}<span class="count num">${n}</span></button>`;
  const snoozedN = mailSnoozed().length;
  let reader = '';
  if (cur) {
    reader = `<div class="in" style="${areaVars(cur.area)}">
      <div class="bar">
        <button class="btn ghost sq32 only-mobile" data-act="mailBack" aria-label="Back">${I.back}</button>
        ${showSnoozed ? `<button class="btn ink" data-act="mailUnsnooze" data-id="${cur.id}">Bring back now</button>` : `<button class="btn ink" data-act="mailDone" data-id="${cur.id}">Done</button><button class="btn" data-act="mailSnooze" data-id="${cur.id}">Snooze</button>`}
        <button class="btn" data-act="mailTodo" data-id="${cur.id}">Make to-do</button>
        <button class="btn ghost" data-act="editMail" data-id="${cur.id}">Edit</button>
        <span style="margin-left:auto">${tagHtml(cur.area)}</span>
      </div>
      <h2>${esc(cur.subject || '(no subject)')}</h2>
      <div class="who"><span class="avatar">${esc((cur.from || '?').trim()[0] || '?').toUpperCase()}</span><div style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:500">${esc(cur.from)}</span><span class="muted" style="font-size:12px">${[cur.org, cur.email].filter(Boolean).map(esc).join(' · ')}${cur.org || cur.email ? ' · ' : ''}${age(cur.added)} ago${cur.snooze && showSnoozed ? ' · back ' + fmtDDM(new Date(cur.snooze)) + ', ' + fmt12(new Date(cur.snooze)) : ''}</span></div></div>
      <div class="body">${paras(cur.body).map(p => `<p>${esc(p)}</p>`).join('') || '<p class="muted">No notes.</p>'}</div>
      ${cur.draft != null ? `<div class="card draft">
        <div class="card-h"><span class="t" style="font-size:13px">Draft reply</span><span class="meta hide-m">Edit before sending</span></div>
        <textarea id="draft" data-id="${cur.id}" rows="5">${esc(cur.draft)}</textarea>
        <div class="acts">
          <button class="btn accent" data-act="mailSend" data-id="${cur.id}">Open in Mail</button>
          <button class="btn" data-act="mailCopy" data-id="${cur.id}">Copy</button>
          <button class="btn ghost" data-act="mailDiscard" data-id="${cur.id}">Discard</button>
        </div>
      </div>` : `<div class="nodraft"><span>No draft yet.</span><button class="btn" data-act="mailDraft" data-id="${cur.id}">Draft a reply</button></div>`}
    </div>`;
  } else if (list.length) reader = '';
  else reader = `<div class="empty" style="padding-top:80px">Nothing here.</div>`;
  return `<div class="mailpage${cur && ui.mailOpen ? ' reading' : ''}">
    <div class="mailside">
      <div class="titles"><div class="eyebrow num">${waiting.length} waiting on you</div><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h1>Mail</h1><button class="btn sm" data-act="newMail">Add</button></div></div>
      <div class="filters">
        ${filt('All', 'All waiting', waiting.length)}
        ${areasWithMail.map(a => filt(a, a, waiting.filter(m => m.area === a).length, true)).join('')}
        ${snoozedN ? filt('__snoozed', 'Snoozed', snoozedN) : ''}
      </div>
      <div class="foot">Add the emails you owe a reply. Desk keeps the list and your drafts.<br>Nothing sends without you.</div>
    </div>
    <div class="maillist">
      ${list.map(m => mailRow(m, cur && m.id === cur.id)).join('') || `<div class="empty" style="padding:40px 18px">${state.mail.length ? 'Nothing waiting here.' : 'Nothing waiting on you.'}<br><button class="btn sm" data-act="newMail">Add an email</button></div>`}
    </div>
    <div class="reader">${reader}</div>
  </div>`;
}

/* ---------- page: money ---------- */
function pageMoney() {
  const [y, m] = viewMonth();
  const st = monthStats(y, m);
  const t = today();
  const isCur = ui.monthOff === 0;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const status = isCur ? (t.getDate() === lastDay ? 'last day' : `${lastDay - t.getDate()} days left`) : ui.monthOff < 0 ? 'closed' : 'ahead';
  const tab = ui.moneyTab;
  const keep = r => tab === 'All' || (tab === 'In' ? r.amount > 0 : r.amount < 0);
  const past = st.rows.filter(r => r.d < t && keep(r)), fut = st.rows.filter(r => r.d >= t && keep(r));
  const sum = a => a.reduce((s, r) => s + r.amount, 0);
  const max = Math.max(st.inAll, st.outAll) || 1;
  const pc = n => (Math.max(0, n) / max * 100).toFixed(2) + '%';
  const row = (r, f) => `<button class="lrow${f ? ' fut' : ''}" data-act="editMoney" data-src="${r.src}" data-id="${r.id}">
    <span class="date num">${fmtDM(r.d)}</span>
    <span class="nm"><b>${esc(r.name)}</b><span style="${areaVars(r.area)}"><span class="dot"></span>${esc(r.note || kindLabel(r))}</span></span>
    <span class="amt num${r.amount < 0 ? ' out' : ''}">${signed(r.amount)}</span>
  </button>`;

  const subs = state.recurring.filter(r => r.kind === 'sub' && activeRec(r)).map(r => ({ r, mo: perMonth(r), next: nextOccurrence(r) })).sort((a, b) => b.mo - a.mo);
  const subTotal = subs.reduce((s, x) => s + x.mo, 0);
  const bills = state.recurring.filter(r => r.kind === 'bill' && activeRec(r)).map(r => {
    const occ = occurrences(r, y, m);
    const amt = occ.length * Math.abs(r.amount);
    const when = r.freq === 'monthly'
      ? [r.note, occ[0] ? fmtDM(occ[0]) : 'not this month'].filter(Boolean).join(' · ')
      : `${money(r.amount)} ${r.freq}, ${DOWL[fromYmd(r.start).getDay()]}s · ${occ.length} this month`;
    return { r, amt, when };
  }).sort((a, b) => b.amt - a.amt);
  const billTotal = bills.reduce((s, b) => s + b.amt, 0);
  const showFuture = ui.monthOff >= 0;
  const showPast = ui.monthOff <= 0;

  return `<div class="page">
    <header class="phead">
      <div class="titles"><div class="eyebrow num">${MONL[m]} ${y} · ${status}</div><h1>Money</h1></div>
      <div class="tools">
        <button class="btn sq32" data-act="monthMove" data-n="-1" aria-label="Previous month">‹</button>
        ${isCur ? '' : '<button class="btn" data-act="monthNow">This month</button>'}
        <button class="btn sq32" data-act="monthMove" data-n="1" aria-label="Next month">›</button>
        <div class="seg soft" style="margin-left:8px">${['All', 'In', 'Out'].map(n => `<button class="${tab === n ? 'on' : ''}" data-act="moneyTab" data-v="${n}">${n}</button>`).join('')}</div>
        <button class="btn ink" data-act="newMoney">Add</button>
      </div>
    </header>
    <div class="card summary">
      <div class="cells">
        <div class="cell"><span class="l">Money in</span><span class="v">${money(st.inGot)}</span><span class="s">received · ${money(st.inAll)} expected</span></div>
        <div class="cell"><span class="l">Money out</span><span class="v">${money(st.outGot)}</span><span class="s">spent · ${money(st.outAll)} committed</span></div>
        <div class="cell"><span class="l">Left at month end</span><span class="v">${st.net < 0 ? '−' : ''}${money(st.net)}</span><span class="s">projected, before day-to-day spending</span></div>
      </div>
      <div class="bars">
        <div class="bar"><span class="l">In</span><div class="track"><div class="a" style="width:${pc(st.inGot)}"></div><div class="b" style="width:${pc(st.inAll - st.inGot)}"></div></div><span class="r">${money(st.inGot)} of ${money(st.inAll)}</span></div>
        <div class="bar"><span class="l">Out</span><div class="track out"><div class="a" style="width:${pc(st.outGot)}"></div><div class="b" style="width:${pc(st.outAll - st.outGot)}"></div></div><span class="r">${money(st.outGot)} of ${money(st.outAll)}</span></div>
      </div>
    </div>
    <div class="grid2 g15">
      <div class="card">
        ${showPast ? `<div class="lhead"><span class="t" style="font-size:14px;font-weight:600">So far</span><span class="meta num" style="font-size:13px;color:var(--ink3)">${signed(sum(past))}</span></div>
        ${past.map(r => row(r, false)).join('')}` : ''}
        ${showFuture ? `<div class="lhead${showPast ? ' sub' : ''}"><span style="font-size:14px;font-weight:600">Still to come</span><span class="num" style="font-size:13px;color:var(--ink3)">${signed(sum(fut))}</span></div>
        ${fut.map(r => row(r, true)).join('')}` : ''}
        ${!st.rows.length ? `<div class="empty" style="border-top:1px solid var(--line)">No money in or out yet.<br><button class="btn sm" data-act="newMoney">Add an entry</button></div>` : ''}
      </div>
      <div class="col">
        <div class="card">
          <div class="subhead">
            <div class="r1"><span style="font-size:14px;font-weight:600">Subscriptions</span><span class="num" style="font-size:14px;font-weight:500">${money(subTotal)}<span class="per"> /mo</span></span></div>
            <span class="num muted" style="font-size:12px">${money(subTotal * 12)} a year · ${subs.length} active</span>
          </div>
          <div class="rows">${subs.map(({ r, mo, next }) => {
            const key = r.id + ':' + (next ? ymd(next) : '');
            const done = !!state.reviewed[key];
            return `<div class="subrow">
              <button class="nm" data-act="editMoney" data-src="rec" data-id="${r.id}"><b>${esc(r.name)}</b><span>${next ? (ymd(next) === todayStr() ? 'Renews today' : 'Renews ' + fmtDM(next)) : 'No upcoming renewal'}</span></button>
              <span class="amt num">${money(mo)}</span>
              <button class="btn xs" data-act="reviewSub" data-id="${r.id}" ${done ? 'disabled' : ''}>${done ? 'To-do added' : 'Review'}</button>
            </div>`;
          }).join('') || `<div class="empty">No subscriptions. Add one with Add, set to repeat.</div>`}</div>
        </div>
        <div class="card">
          <div class="card-h"><span class="t">Monthly payments</span><span class="num" style="font-size:14px;font-weight:500">${money(billTotal)}<span class="per"> /mo</span></span></div>
          <div class="rows">${bills.map(({ r, amt, when }) => `<div class="subrow bill">
            <button class="nm" data-act="editMoney" data-src="rec" data-id="${r.id}"><b>${esc(r.name)}</b><span>${esc(when)}</span></button>
            <span class="amt num">${money(amt)}</span>
          </div>`).join('') || `<div class="empty">No regular bills yet.</div>`}</div>
        </div>
      </div>
    </div>
  </div>`;
}
const kindLabel = r => ({ inc: 'Income', bill: 'Bill', sub: 'Subscription', spend: 'Spending' }[r.kind] || '');

/* ---------- page: settings ---------- */
function pageSettings() {
  const theme = state.theme;
  const counts = n => state.todos.filter(t => t.area === n && !t.done).length;
  const icsN = state.events.filter(e => e.src === 'ics').length;
  return `<div class="page narrow">
    <h1>Settings</h1>
    <div class="sect"><span class="t">You</span>
      <div class="card"><div class="srow"><div class="grow"><b style="font-weight:500">Name</b><span>Used for the greeting and reply drafts</span></div><input class="input" style="max-width:220px" id="setName" value="${esc(state.name)}" placeholder="First name"></div></div>
    </div>
    <div class="sect"><span class="t">Your data</span><span class="d">Everything lives in this browser on this device. Nothing goes to a server. To move it to another device, export a backup here and import it there.</span>
      <div class="card rows">
        <div class="srow"><div class="grow"><b style="font-weight:500">Backup</b><span>${plural(state.todos.length, 'to-do')} · ${plural(state.ideas.length, 'idea')} · ${plural(state.events.length, 'event')} · ${plural(state.mail.length, 'email')} · ${plural(state.entries.length + state.recurring.length, 'money item')}</span></div>
          <button class="btn" data-act="exportData">Export</button><button class="btn" data-act="importData">Import</button></div>
        <div class="srow"><div class="grow"><b style="font-weight:500">Sample data</b><span>Fill Desk with example to-dos, events, mail and money</span></div><button class="btn" data-act="loadSample">Load sample</button></div>
        <div class="srow"><div class="grow"><b style="font-weight:500">Erase everything</b><span>Clears all data in this browser</span></div><button class="btn danger" data-act="eraseAll">Erase</button></div>
      </div>
    </div>
    <div class="sect"><span class="t">Calendar import</span><span class="d">In Google Calendar, go to Settings, Import &amp; export, Export. Unzip it and pick the .ics file here. Importing again replaces the last import. Repeating events show for the next 12 months.</span>
      <div class="card"><div class="srow"><div class="grow"><b style="font-weight:500">Import .ics</b><span>${icsN ? plural(icsN, 'imported event') : 'Nothing imported yet'}</span></div>
        <select class="sel" id="icsArea" aria-label="Area for imported events">${areaOptions(state.icsArea || 'Personal')}</select>
        <button class="btn" data-act="importIcs">Choose file</button>${icsN ? '<button class="btn ghost" data-act="clearIcs">Remove</button>' : ''}</div></div>
    </div>
    <div class="sect"><span class="t">Areas</span>
      <div class="card rows">
        ${state.areas.map((a, i) => `<div class="srow" style="padding-top:10px;padding-bottom:10px">
          <input type="color" class="swatch" data-change="areaColor" data-i="${i}" value="${a.color || '#56524B'}" aria-label="Colour for ${esc(a.name)}">
          <span style="flex:1;font-size:14px">${esc(a.name)}${a.color ? '' : ' <span class="muted" style="font-size:12px">· neutral</span>'}</span>
          <span class="muted num nowrap" style="font-size:12px">${plural(counts(a.name), 'open to-do')}</span>
          <button class="btn ghost sm" data-act="removeArea" data-i="${i}">Remove</button>
        </div>`).join('')}
        <div class="srow"><input class="input" id="newArea" placeholder="New area name" style="flex:1"><button class="btn" data-act="addArea">Add area</button></div>
      </div>
    </div>
    <div class="sect"><span class="t">Appearance</span>
      <div class="card rows">
        <div class="srow"><span style="flex:1">Theme</span><div class="seg">${['light', 'dark', 'system'].map(v => `<button class="${theme === v ? 'on' : ''}" data-act="setTheme" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
        <div class="srow"><span style="flex:1">Accent</span><div class="seg">${['Vermilion', 'Cobalt', 'Ink'].map(v => `<button class="${state.accent === v ? 'on' : ''}" data-act="setAccent" data-v="${v}">${v}</button>`).join('')}</div></div>
      </div>
    </div>
    <div class="sect"><span class="t">Install</span><span class="d">On iPhone, open this page in Safari, tap Share, then Add to Home Screen. On Android or desktop Chrome, use Install app in the browser menu. Desk then opens like an app and works offline.</span></div>
    <p class="muted" style="font-size:12px">Keyboard: ⌘K capture · ⌘/ search · Esc closes</p>
  </div>`;
}

/* ---------- modals ---------- */
const fieldHtml = (label, inner) => `<label class="field"><span>${label}</span>${inner}</label>`;
function dueChips(sel) {
  const t = today();
  const opts = [['', 'No date'], [ymd(t), 'Today'], [ymd(addDays(t, 1)), 'Tomorrow'], [ymd(addDays(t, 2)), fmtDDM(addDays(t, 2))]];
  const custom = sel && !opts.some(o => o[0] === sel);
  return `<div class="chips">${opts.map(([v, l]) => `<button type="button" class="chip pick${(sel || '') === v ? ' on' : ''}" data-act="mPick" data-k="due" data-v="${v}">${l}</button>`).join('')}
    <input type="date" class="input" name="dueCustom" value="${custom ? sel : ''}" style="width:auto;height:34px;${custom ? 'border-color:var(--ink)' : ''}" aria-label="Pick a date"></div>`;
}
function areaChips(sel) {
  return `<div class="chips">${areaNames().map(n => `<button type="button" class="chip pick${sel === n ? ' on' : ''}" data-act="mPick" data-k="area" data-v="${esc(n)}" style="${areaVars(n)}"><span class="sq"></span>${esc(n)}</button>`).join('')}</div>`;
}
function modalHtml() {
  const M = ui.modal; if (!M) return '';
  const d = M.data;
  const head = (title, left = 'Cancel') => `<span class="grab"></span><div class="sh"><button type="button" class="link" data-act="closeModal">${left}</button><b>${title}</b><span style="width:44px"></span></div>`;
  let body = '';
  if (M.type === 'capture') {
    const task = d.kind === 'task';
    body = `${head(M.title || 'Quick capture')}
      <div class="seg full"><button type="button" class="${task ? 'on' : ''}" data-act="mPick" data-k="kind" data-v="task">Task</button><button type="button" class="${task ? '' : 'on'}" data-act="mPick" data-k="kind" data-v="idea">Idea</button></div>
      <textarea class="captext" name="text" placeholder="${task ? 'What needs doing?' : 'What’s the idea?'}" rows="3">${esc(d.text)}</textarea>
      <div class="field"><span>Area</span>${areaChips(d.area)}</div>
      ${task ? `<div class="field"><span>Due</span>${dueChips(d.due)}</div>` : ''}
      <button class="btn accent big" type="submit">${task ? 'Add task' : 'Save idea'}</button>`;
  } else if (M.type === 'todo') {
    body = `${head('To-do')}
      ${fieldHtml('Title', `<input class="input" name="title" value="${esc(d.title)}" required>`)}
      <div class="field"><span>Area</span>${areaChips(d.area)}</div>
      <div class="field"><span>Due</span>${dueChips(d.due)}</div>
      <div class="foot"><button type="button" class="btn ghost danger" data-act="deleteTodo">Delete</button><div class="right"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn ink" type="submit">Save</button></div></div>`;
  } else if (M.type === 'idea') {
    body = `${head('Idea')}
      ${fieldHtml('Idea', `<textarea class="input" name="text" rows="3" required>${esc(d.text)}</textarea>`)}
      <div class="field"><span>Area</span>${areaChips(d.area)}</div>
      <div class="foot"><button type="button" class="btn ghost danger" data-act="deleteIdea">Delete</button><div class="right"><button type="button" class="btn" data-act="promoteIdea" data-id="${M.id}">Make to-do</button><button class="btn ink" type="submit">Save</button></div></div>`;
  } else if (M.type === 'event') {
    body = `${head(M.id ? 'Event' : 'New event')}
      ${fieldHtml('Title', `<input class="input" name="title" value="${esc(d.title)}" required>`)}
      ${fieldHtml('Where', `<input class="input" name="where" value="${esc(d.where)}" placeholder="Optional">`)}
      <div class="frow three">
        ${fieldHtml('Date', `<input class="input" type="date" name="date" value="${esc(d.date)}" required>`)}
        ${d.allDay ? '' : fieldHtml('Starts', `<input class="input" type="time" name="start" value="${esc(d.start)}" required>`)}
        ${d.allDay ? '' : fieldHtml('Ends', `<input class="input" type="time" name="end" value="${esc(d.end)}">`)}
      </div>
      <label class="checkline"><input type="checkbox" name="allDay" data-change="mAllDay" ${d.allDay ? 'checked' : ''}> All day</label>
      <div class="field"><span>Area</span>${areaChips(d.area)}</div>
      <div class="foot">${M.id ? '<button type="button" class="btn ghost danger" data-act="deleteEvent">Delete</button>' : ''}<div class="right"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn ink" type="submit">Save</button></div></div>`;
  } else if (M.type === 'mail') {
    body = `${head(M.id ? 'Edit email' : 'Add email to answer')}
      <div class="frow">${fieldHtml('From', `<input class="input" name="from" value="${esc(d.from)}" required placeholder="Name">`)}${fieldHtml('Organisation', `<input class="input" name="org" value="${esc(d.org)}" placeholder="Optional">`)}</div>
      ${fieldHtml('Their email', `<input class="input" type="email" name="email" value="${esc(d.email)}" placeholder="Optional, used when you reply">`)}
      ${fieldHtml('Subject', `<input class="input" name="subject" value="${esc(d.subject)}" required>`)}
      ${fieldHtml('What they asked', `<textarea class="input" name="body" rows="4" placeholder="Paste the email or jot the gist">${esc(d.body)}</textarea>`)}
      <div class="field"><span>Area</span>${areaChips(d.area)}</div>
      <div class="foot">${M.id ? '<button type="button" class="btn ghost danger" data-act="deleteMail">Delete</button>' : ''}<div class="right"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn ink" type="submit">Save</button></div></div>`;
  } else if (M.type === 'money') {
    const isIn = d.dir === 'in';
    const kinds = isIn ? [['inc', 'Income']] : [['spend', 'Spending'], ['bill', 'Bill'], ['sub', 'Subscription']];
    body = `${head(M.id ? 'Edit' : 'Add money in or out')}
      <div class="seg full"><button type="button" class="${isIn ? 'on' : ''}" data-act="mPick" data-k="dir" data-v="in">Money in</button><button type="button" class="${isIn ? '' : 'on'}" data-act="mPick" data-k="dir" data-v="out">Money out</button></div>
      <div class="frow">${fieldHtml('Name', `<input class="input" name="name" value="${esc(d.name)}" required placeholder="${isIn ? 'Client or payer' : 'Shop or payee'}">`)}${fieldHtml('Amount', `<input class="input num" name="amount" inputmode="decimal" value="${esc(d.amount)}" required placeholder="0.00">`)}</div>
      <div class="frow">${fieldHtml(d.repeat === 'none' ? 'Date' : 'First date', `<input class="input" type="date" name="date" value="${esc(d.date)}" required>`)}${fieldHtml('Repeats', `<select class="input" name="repeat" data-change="mRepeat">${[['none', 'Doesn’t repeat'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly']].map(([v, l]) => `<option value="${v}"${d.repeat === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      <div class="frow">${fieldHtml('Type', `<select class="input" name="kind">${kinds.map(([v, l]) => `<option value="${v}"${d.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}${fieldHtml('Note', `<input class="input" name="note" value="${esc(d.note)}" placeholder="Optional">`)}</div>
      <div class="field"><span>Area</span>${areaChips(d.area)}</div>
      <div class="foot">${M.id ? `<button type="button" class="btn ghost danger" data-act="deleteMoney">Delete</button>${M.src === 'rec' && !d.end ? '<button type="button" class="btn ghost" data-act="stopMoney">Stop from today</button>' : ''}` : ''}<div class="right"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn ink" type="submit">Save</button></div></div>`;
  } else if (M.type === 'search') {
    body = `<span class="grab"></span><div class="capbar" style="height:44px">${I.search}<input name="q" id="q" placeholder="Search to-dos, ideas, events, mail, money" autocomplete="off" value="${esc(d.q)}"></div>
      <div class="results" id="results">${searchResults(d.q)}</div>`;
  }
  return `<div class="scrim" data-act="scrim"><form class="sheet${M.type === 'money' || M.type === 'mail' ? ' wide' : ''}${M.type === 'search' ? ' search' : ''}" id="mform" novalidate autocomplete="off">${body}</form></div>`;
}
function openModal(type, data, extra = {}) {
  ui.modal = { type, data, ...extra };
  renderModal(true);
}
function closeModal() { ui.modal = null; renderModal(); renderToast(); }
function syncModal() {
  const f = $('#mform'); if (!f || !ui.modal) return;
  const d = ui.modal.data;
  [...f.elements].forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') d[el.name] = el.checked;
    else if (el.name === 'dueCustom') { if (el.value) d.due = el.value; }
    else d[el.name] = el.value;
  });
}
function renderModal(focus) {
  $('#modal').innerHTML = modalHtml();
  document.body.style.overflow = ui.modal ? 'hidden' : '';
  if (focus && ui.modal) {
    const el = $('#mform [name=q], #mform textarea.captext, #mform input[name]:not([type=checkbox]):not([type=date]):not([type=time])');
    if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); }
  }
}
function rerenderModal() {
  syncModal();
  const active = document.activeElement && document.activeElement.name;
  renderModal();
  if (active) { const el = $(`#mform [name="${active}"]`); if (el && el.type !== 'date') el.focus(); }
}

/* ---------- search ---------- */
function searchResults(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return `<div class="empty">Type to search.</div>`;
  const hit = s => String(s || '').toLowerCase().includes(q);
  const res = [];
  state.todos.forEach(t => hit(t.title) && res.push(['To-do', t.title, 'todo', t.id, t.area]));
  state.ideas.forEach(t => hit(t.text) && res.push(['Idea', t.text, 'idea', t.id, t.area]));
  state.events.forEach(e => (hit(e.title) || hit(e.where)) && res.push(['Event', `${e.title} · ${fmtDDM(fromYmd(e.date))}`, 'event', e.id, e.area]));
  state.mail.forEach(m => (hit(m.subject) || hit(m.from) || hit(m.body)) && res.push(['Mail', `${m.subject} · ${m.from}`, 'mail', m.id, m.area]));
  state.entries.forEach(e => (hit(e.name) || hit(e.note)) && res.push(['Money', `${e.name} · ${signed(e.amount)} · ${fmtDM(fromYmd(e.date))}`, 'entry', e.id, e.area]));
  state.recurring.forEach(e => (hit(e.name) || hit(e.note)) && res.push(['Money', `${e.name} · ${signed(e.amount)} ${e.freq}`, 'rec', e.id, e.area]));
  if (!res.length) return `<div class="empty">No matches.</div>`;
  return res.slice(0, 30).map(([k, txt, type, id, area]) => `<button type="button" class="res" data-act="searchGo" data-type="${type}" data-id="${id}" style="${areaVars(area)}"><span class="kind">${k}</span><span class="dot"></span><span class="txt">${esc(txt)}</span></button>`).join('');
}

/* ---------- theme ---------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = state.theme === 'dark' || (state.theme === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.accent = state.accent;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#171614' : '#FAF8F4';
}
mq.addEventListener && mq.addEventListener('change', () => { if (state.theme === 'system') { applyTheme(); render(); } });

/* ---------- main render ---------- */
const PAGE_FN = { today: pageToday, tasks: pageTasks, calendar: pageCalendar, mail: pageMail, money: pageMoney, settings: pageSettings };
let lastPage = null;
function render() {
  applyTheme();
  const main = $('#main');
  const keep = main && lastPage === ui.page ? main.scrollTop : 0;
  const cal = $('#calscroll'); const calTop = cal ? cal.scrollTop : null;
  const ae = document.activeElement;
  const focusId = ae && ae.id && !$('#modal').contains(ae) ? ae.id : null;
  const selStart = focusId && ae.selectionStart != null ? ae.selectionStart : null;
  const capVal = $('#cap') ? $('#cap').value : '';

  $('#app').innerHTML = `<div class="app">${sidebar()}<main class="main" id="main">${mobileTop()}${PAGE_FN[ui.page]()}</main>${tabbar()}</div>`;

  const newMain = $('#main'); newMain.scrollTop = keep;
  const cs = $('#calscroll');
  if (cs) {
    if (calTop != null && lastPage === 'calendar') cs.scrollTop = calTop;
    else { const h = new Date().getHours(); cs.scrollTop = (h >= 9 && h <= 20 ? h - 2 : 7.5) * 52; }
  }
  if ($('#cap')) $('#cap').value = capVal;
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (selStart != null && el.setSelectionRange) try { el.setSelectionRange(selStart, selStart); } catch (e) { /* noop */ } } }
  document.title = { today: 'Desk', tasks: 'Ideas & to-dos · Desk', calendar: 'Calendar · Desk', mail: 'Mail · Desk', money: 'Money · Desk', settings: 'Settings · Desk' }[ui.page];
  lastPage = ui.page;
  renderToast();
}

function go(page) {
  if (!PAGES.includes(page)) page = 'today';
  if (ui.page !== page) { ui.page = page; if (location.hash.slice(1) !== page) history.pushState(null, '', '#' + page); }
  if (page !== 'mail') ui.mailOpen = false;
  render();
  $('#main').scrollTop = 0;
}
window.addEventListener('popstate', () => { ui.page = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today'; ui.mailOpen = false; render(); });

/* ---------- capture ---------- */
const isMobile = () => matchMedia('(max-width: 760px)').matches;
function startCapture() {
  if (isMobile()) { A.newItem(); return; }
  if (ui.page !== 'today') go('today');
  const c = $('#cap'); if (c) c.focus();
}
function addTodo(title, area, due) {
  state.todos.push({ id: uid(), title, area, due: due || null, done: false, created: Date.now() });
}
function addIdea(text, area) { state.ideas.push({ id: uid(), text, area, created: Date.now() }); }
function capSave() {
  const input = $('#cap'); const text = input.value.trim(); if (!text) { input.focus(); return; }
  const area = $('#capArea').value; ui.capArea = area;
  input.value = '';
  if (ui.capType === 'task') change(() => addTodo(text, area, todayStr()), `Added to to-dos · ${area} · due today`, true);
  else change(() => addIdea(text, area), `Saved to Ideas inbox · ${area}`, true);
  $('#cap') && $('#cap').focus();
}

/* ---------- money helpers ---------- */
function moneyRecord(src, id) { return src === 'rec' ? state.recurring.find(r => r.id === id) : state.entries.find(e => e.id === id); }
function openMoney(src, id) {
  const r = id ? moneyRecord(src, id) : null;
  if (id && !r) return;
  const data = r ? {
    dir: r.amount > 0 ? 'in' : 'out', name: r.name, amount: Math.abs(r.amount).toFixed(2), date: src === 'rec' ? r.start : r.date,
    repeat: src === 'rec' ? r.freq : 'none', kind: r.kind, note: r.note || '', area: r.area, end: r.end || null,
  } : { dir: 'out', name: '', amount: '', date: todayStr(), repeat: 'none', kind: 'spend', note: '', area: firstArea() };
  openModal('money', data, { id: r ? r.id : null, src });
}

/* ---------- ICS import ---------- */
function icsDate(v) {
  const m = String(v).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m;
  return z ? new Date(Date.UTC(+y, mo - 1, +d, +h, +mi, +s)) : new Date(+y, mo - 1, +d, +h, +mi, +s);
}
function icsDur(v) {
  const m = String(v).match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
  if (!m) return null;
  return ((+m[1] || 0) * 7 * 864e5) + ((+m[2] || 0) * 864e5) + ((+m[3] || 0) * 36e5) + ((+m[4] || 0) * 6e4) + ((+m[5] || 0) * 1e3);
}
const icsText = v => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
function parseICS(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const evs = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { ex: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const val = line.slice(i + 1);
    const isDate = params.includes('VALUE=DATE');
    if (name === 'SUMMARY') cur.title = icsText(val);
    else if (name === 'LOCATION') cur.where = icsText(val);
    else if (name === 'DTSTART') { cur.start = icsDate(val); cur.allDay = isDate || /^\d{8}$/.test(val); }
    else if (name === 'DTEND') cur.end = icsDate(val);
    else if (name === 'DURATION') cur.dur = icsDur(val);
    else if (name === 'RRULE') cur.rrule = Object.fromEntries(val.split(';').map(x => x.split('=')));
    else if (name === 'EXDATE') val.split(',').forEach(v => { const d = icsDate(v); if (d) cur.ex.push(+d); });
    else if (name === 'RECURRENCE-ID') cur.recId = icsDate(val);
    else if (name === 'UID') cur.uid = val;
    else if (name === 'STATUS') cur.status = val;
  }
  return evs;
}
function expandRule(ev, from, to) {
  if (!ev.rrule) return [ev.start];
  const r = ev.rrule, interval = +(r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity, until = r.UNTIL ? icsDate(r.UNTIL) : null;
  const out = []; let n = 0, guard = 0;
  const push = d => { if (until && d > until) return false; if (n >= count || d > to) return false; n++; if (d >= from) out.push(new Date(d)); return true; };
  if (r.FREQ === 'WEEKLY') {
    const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const days = (r.BYDAY ? r.BYDAY.split(',').map(x => codes.indexOf(x.slice(-2))) : [ev.start.getDay()]).filter(x => x >= 0).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    let wk = mondayOf(ev.start);
    while (guard++ < 3000) {
      for (const wd of days) {
        const d = addDays(wk, (wd + 6) % 7); d.setHours(ev.start.getHours(), ev.start.getMinutes(), 0, 0);
        if (d < ev.start) continue;
        if (!push(d)) return out;
      }
      wk = addDays(wk, 7 * interval);
    }
  } else if (['DAILY', 'MONTHLY', 'YEARLY'].includes(r.FREQ)) {
    let k = 0;
    while (guard++ < 20000) {
      const d = new Date(ev.start);
      if (r.FREQ === 'DAILY') d.setDate(d.getDate() + k * interval);
      else if (r.FREQ === 'MONTHLY') { d.setDate(1); d.setMonth(d.getMonth() + k * interval); if (ev.start.getDate() > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) { k++; continue; } d.setDate(ev.start.getDate()); }
      else d.setFullYear(d.getFullYear() + k * interval);
      if (!push(d)) break;
      k++;
    }
  } else out.push(ev.start);
  return out;
}
function importICS(text, area) {
  const raw = parseICS(text);
  const from = addDays(today(), -60), to = addDays(today(), 366);
  const overrides = new Set(raw.filter(e => e.recId).map(e => e.uid + '|' + +e.recId));
  const out = [];
  raw.forEach(ev => {
    if (ev.status === 'CANCELLED') return;
    const dur = ev.end ? ev.end - ev.start : ev.dur != null ? ev.dur : (ev.allDay ? 864e5 : 36e5);
    expandRule(ev, from, to).forEach(s => {
      if (ev.ex.includes(+s)) return;
      if (!ev.recId && overrides.has(ev.uid + '|' + +s)) return;
      const e = new Date(+s + dur);
      if (ev.allDay) {
        const n = Math.max(1, Math.min(14, Math.round(dur / 864e5)));
        for (let i = 0; i < n; i++) out.push({ id: uid(), title: ev.title || '(no title)', where: ev.where || '', area, date: ymd(addDays(s, i)), start: '00:00', end: '23:59', allDay: true, src: 'ics' });
      } else {
        const sameDay = ymd(e) === ymd(s);
        out.push({ id: uid(), title: ev.title || '(no title)', where: ev.where || '', area, date: ymd(s), start: hhmm(s), end: sameDay ? hhmm(e) : '24:00', allDay: false, src: 'ics' });
      }
    });
  });
  return out;
}
function pickFile(accept, cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept;
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => cb(String(rd.result)); rd.readAsText(f); };
  inp.click();
}

/* ---------- sample data ---------- */
function sample() {
  const t = today(), D = n => ymd(addDays(t, n)), y = t.getFullYear(), m = t.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const day = n => ymd(new Date(y, m, Math.min(n, dim)));
  const now = Date.now(), ago = h => new Date(now - h * 36e5).toISOString();
  const s = fresh();
  s.name = state.name; s.welcomed = true; s.theme = state.theme; s.accent = state.accent;
  const td = (title, area, off, done) => ({ id: uid(), title, area, due: off == null ? null : D(off), done: !!done, doneOn: done ? todayStr() : undefined, created: now });
  s.todos = [
    td('Deliver MHQ podcast ep 41 final edit', 'MHQ', -1),
    td('Cut three short-form edits from Partly launch shoot', 'Partly', 0),
    td('Grad film: lock picture cut v3 for sound', 'SAE', 0),
    td('Log this month’s work and draft invoices', 'Personal', 0),
    td('Script "Lighting a desk setup under $500"', 'Channel', 0, true),
    td('Confirm grad film running time with SAE', 'SAE', 1),
    td('Send ESA orientation photo selects to Hannah', 'ESA', 2),
    td('Film desk lighting B-roll', 'Channel', 3),
    td('Reply to ESA about shooting the AGM', 'ESA', 5),
    td('Quote Partly for Q4 short-form content', 'Partly', 9),
    td('Renew Adobe Creative Cloud', 'Personal', 12),
  ];
  const idea = (text, area, d) => ({ id: uid(), text, area, created: now - d * 864e5 });
  s.ideas = [
    idea('Video: what a $500 desk lighting setup actually looks like on camera', 'Channel', 0),
    idea('60-second rate explainer series, shot on the whiteboard wall', 'MHQ', 1),
    idea('Grad film title card in hand-drawn type?', 'SAE', 2),
    idea('Pitch Partly a monthly retainer for short-form', 'Partly', 3),
    idea('Suggest a rent-to-buy credit for Photogear customers', 'Photogear', 5),
    idea('Sell the old A7 III body before the new year', 'Personal', 7),
  ];
  const mon = mondayOf(t);
  const WEEK = [
    [[10, 13, 'Partly launch shoot', 'Partly'], [17.5, 21.5, 'Photogear shift', 'Photogear', 'Photogear, Kingsland']],
    [[9.5, 11, 'Grad film edit review', 'SAE'], [13, 14, 'MHQ content planning', 'MHQ'], [19, 20, 'Film desk lighting intro', 'Channel']],
    [[11, 12.5, 'MHQ podcast recording · ep 42', 'MHQ', 'Mortgage HQ studio, Newmarket'], [14, 15, 'ESA exec meeting', 'ESA', 'Google Meet'], [17.5, 21.5, 'Photogear shift', 'Photogear', 'Photogear, Kingsland']],
    [[9, 12, 'SAE edit suite', 'SAE'], [15, 16, 'Partly feedback call', 'Partly']],
    [[13, 17, 'Grad film sound mix', 'SAE'], [18, 19.5, 'Gym', 'Personal']],
    [[10, 16, 'Photogear shift', 'Photogear', 'Photogear, Kingsland']],
    [[18, 20, 'Family dinner', 'Personal']],
  ];
  const tm = x => `${pad(Math.floor(x))}:${pad(Math.round((x % 1) * 60))}`;
  [0, 7].forEach(wk => WEEK.forEach((evs, i) => evs.forEach(([a, b, title, area, where]) => s.events.push({ id: uid(), title, where: where || '', area, date: ymd(addDays(mon, i + wk)), start: tm(a), end: tm(b), allDay: false }))));
  const mail = (area, from, org, h, subject, body, draft) => ({ id: uid(), area, from, org, email: '', added: ago(h), subject, body, draft: draft || null });
  const first = state.name || 'Steven';
  s.mail = [
    mail('MHQ', 'Lachlan Reid', 'Mortgage HQ', 48, 'Ep 42 guest questions, can you confirm by 10?', `Hey ${first},\n\nAttached the run sheet for today. Can you check the intro timing and confirm the guest questions by 10? I want to send them over before we sit down.\n\nCheers, Lachlan`, `Hi Lachlan, questions look good. I've trimmed the intro to 40 seconds so we get into it faster. See you at 11.\n\n${first}`),
    mail('Partly', 'Mark', 'Partly', 24, 'Re: Launch cutdowns, feedback on v2', 'Looking good. Two notes on the 15s version: the end card needs to hold for a full two seconds, and can we swap the second shot for the wide of the warehouse?\n\nRest is approved.\n\nMark', `Hi Mark, on it. I'll hold the end card for 2s and swap in the warehouse wide. v3 to you by Thursday.\n\n${first}`),
    mail('SAE', 'Post Production', 'SAE', 4, 'Grad screening: DCP delivery specs and deadline', 'All graduating films must be delivered as DCP. Specs are attached.\n\nPlease confirm your running time and aspect ratio by next Friday.'),
    mail('ESA', 'Priya Shah', 'ESA', 26, 'Agenda for today’s exec meeting', `Hi all, the agenda is in the shared doc.\n\n${first}, can you give a quick update on the orientation photo selects?`),
    mail('ESA', 'Tom Walker', 'ESA', 50, 'Can you shoot the AGM?', 'We’d love you to cover the AGM, 6 to 8 pm. Mostly speeches, plus a group photo at the end.\n\nAre you free?'),
    mail('ESA', 'Priya Shah', 'ESA', 74, 'Orientation photo budget sign-off', 'The treasurer needs your final number for the orientation shoot so we can sign it off at the meeting.'),
    mail('ESA', 'Hannah Lee', 'ESA', 122, 'Newsletter: need 3 photos by Friday', 'Could you pick three shots from orientation for the newsletter? Landscape if possible.'),
    mail('MHQ', 'Lachlan Reid', 'Mortgage HQ', 74, 'Thumbnail options for ep 41', 'Can you mock up two thumbnail options for ep 41? One with the guest, one text-only.'),
    mail('MHQ', 'Anna Brooks', 'Mortgage HQ', 98, 'Studio booking moved', 'The studio had a clash, so ep 43 moves to next Wednesday at 11.\n\nDoes that still work for you?'),
    mail('Partly', 'Mark', 'Partly', 146, 'Raw footage folder access', 'Can you send me the Drive link for the raw launch footage? Our designer wants to pull stills.'),
  ];
  const longAgo = ymd(new Date(y, m - 6, 1));
  const firstThu = (() => { let d = new Date(y, m - 6, 1); while (d.getDay() !== 4) d = addDays(d, 1); return ymd(d); })();
  const wages = ymd(addDays(new Date(y, m, Math.min(4, dim)), -14 * 13));
  const rec = (name, note, area, amount, kind, freq, dayN, start) => ({ id: uid(), name, note, area, amount, kind, freq, day: dayN, start: start || longAgo });
  s.recurring = [
    rec('Rent', 'Weekly, Thursdays', 'Personal', -260, 'bill', 'weekly', null, firstThu),
    rec('Photogear', 'Wages · fortnightly', 'Photogear', 612.40, 'inc', 'fortnightly', null, wages),
    rec('Power', 'Flat share', 'Personal', -85, 'bill', 'monthly', 30),
    rec('AA Insurance', 'Car', 'Personal', -62.30, 'bill', 'monthly', 25),
    rec('One NZ', 'Phone', 'Personal', -45, 'bill', 'monthly', 14),
    rec('Google One', 'Subscription · 2 TB', 'Personal', -16.99, 'sub', 'monthly', 5),
    rec('Claude Pro', 'Subscription', 'Personal', -36, 'sub', 'monthly', 9),
    rec('Adobe Creative Cloud', 'Subscription · all apps', 'Channel', -107.99, 'sub', 'monthly', 12),
    rec('Epidemic Sound', 'Subscription · music', 'Channel', -24.99, 'sub', 'monthly', 18),
    rec('Spotify', 'Subscription', 'Personal', -18.99, 'sub', 'monthly', 22),
    rec('Netflix', 'Subscription', 'Personal', -18.49, 'sub', 'monthly', 30),
  ];
  const ent = (dd, name, note, area, amount, kind) => ({ id: uid(), date: day(dd), name, note, area, amount, kind });
  s.entries = [
    ent(1, 'Z Energy', 'Fuel', 'Personal', -72.10, 'spend'),
    ent(6, "Pak'nSave", 'Groceries', 'Personal', -94.20, 'spend'),
    ent(16, 'Mortgage HQ', 'INV-0031 · podcast eps 38 to 41', 'MHQ', 1200, 'inc'),
    ent(20, "Pak'nSave", 'Groceries', 'Personal', -86.40, 'spend'),
    ent(26, 'Photogear', 'SD cards, staff price', 'Channel', -49, 'spend'),
    ent(28, 'Coffee Supreme', 'Coffee', 'Personal', -6.50, 'spend'),
  ];
  return s;
}

/* ---------- actions ---------- */
const byId = (arr, id) => arr.find(x => x.id === id);
const A = {
  go: el => go(el.dataset.page),
  areaGo: el => { ui.taskArea = el.dataset.area; go('tasks'); },
  capture: () => startCapture(),
  newItem: () => openModal('capture', { kind: 'task', text: '', area: ui.taskArea !== 'All' && areaOf(ui.taskArea) ? ui.taskArea : (ui.capArea && areaOf(ui.capArea) ? ui.capArea : firstArea()), due: todayStr() }),
  search: () => openModal('search', { q: '' }),
  undo: () => { const t = ui.toast; if (!t || !t.undo) return; state = JSON.parse(t.undo); save(); ui.toast = null; render(); toast('Undone'); },
  toggleTheme: () => { state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; save(); render(); },

  welcomeStart: () => change(() => { state.name = ($('#welcomeName').value || '').trim(); state.welcomed = true; }),
  welcomeSample: () => { const nm = ($('#welcomeName').value || '').trim(); state.name = nm; change(() => { state = sample(); state.name = nm; }, 'Sample data loaded. Erase it any time in Settings.'); },

  capType: el => { ui.capType = el.dataset.v; render(); $('#cap') && $('#cap').focus(); },
  capSave: () => capSave(),

  toggleTodo: el => change(() => { const t = byId(state.todos, el.dataset.id); if (!t) return; t.done = !t.done; t.doneOn = t.done ? todayStr() : undefined; }),
  editTodo: el => { const t = byId(state.todos, el.dataset.id); if (t) openModal('todo', { title: t.title, area: t.area, due: t.due || '' }, { id: t.id }); },
  deleteTodo: () => { const id = ui.modal.id; closeModal(); change(() => { state.todos = state.todos.filter(t => t.id !== id); }, 'To-do deleted', true); },
  clearDone: () => change(() => { state.todos = state.todos.filter(t => !t.done); }, 'Cleared completed to-dos', true),
  taskArea: el => { ui.taskArea = el.dataset.area; render(); },

  editIdea: el => { const i = byId(state.ideas, el.dataset.id); if (i) openModal('idea', { text: i.text, area: i.area }, { id: i.id }); },
  deleteIdea: () => { const id = ui.modal.id; closeModal(); change(() => { state.ideas = state.ideas.filter(i => i.id !== id); }, 'Idea deleted', true); },
  archiveIdea: el => change(() => { state.ideas = state.ideas.filter(i => i.id !== el.dataset.id); }, 'Idea archived', true),
  promoteIdea: el => {
    const id = el.dataset.id || (ui.modal && ui.modal.id);
    if (ui.modal) { syncModal(); const d = ui.modal.data; const i = byId(state.ideas, id); if (i) { i.text = d.text.trim() || i.text; i.area = d.area; } closeModal(); }
    change(() => { const i = byId(state.ideas, id); if (!i) return; state.ideas = state.ideas.filter(x => x.id !== id); addTodo(i.text, i.area, null); }, 'Moved to to-dos · Later', true);
  },

  newEvent: (el, e, extra) => { const now = new Date(); const h = Math.min(now.getHours() + 1, 22); openModal('event', { title: '', where: '', date: extra && extra.date || ymd(ui.page === 'calendar' && sod(ui.calDate) > today() ? ui.calDate : today()), start: extra && extra.start || `${pad(h)}:00`, end: extra && extra.end || `${pad(h + 1)}:00`, allDay: false, area: firstArea() }); },
  editEvent: (el, e) => { e.stopPropagation(); const v = byId(state.events, el.dataset.id); if (v) openModal('event', { ...v }, { id: v.id }); },
  deleteEvent: () => { const id = ui.modal.id; closeModal(); change(() => { state.events = state.events.filter(x => x.id !== id); }, 'Event deleted', true); },
  slot: (el, e) => {
    if (e.target !== el) return;
    const r = el.getBoundingClientRect();
    let h = Math.floor(((e.clientY - r.top) / 52) * 2) / 2; h = Math.max(0, Math.min(h, 23));
    const tm = x => `${pad(Math.floor(x))}:${x % 1 ? '30' : '00'}`;
    A.newEvent(null, e, { date: el.dataset.date, start: tm(h), end: tm(Math.min(h + 1, 23.5)) });
  },
  calMove: el => { ui.calDate = addDays(ui.calDate, +el.dataset.n * (calView() === 'week' ? 7 : 1)); render(); },
  calToday: () => { ui.calDate = today(); lastPage = null; render(); },
  calView: el => { ui.calView = el.dataset.v; render(); },

  mailArea: el => { ui.mailArea = el.dataset.area; ui.mailSel = null; render(); },
  openMail: el => { const id = el.dataset.id; ui.mailSel = id; ui.mailOpen = true; const m = byId(state.mail, id); if (m && ui.mailArea !== '__snoozed' && ui.mailArea !== 'All' && ui.mailArea !== m.area) ui.mailArea = 'All'; go('mail'); },
  mailBack: () => { ui.mailOpen = false; ui.mailSel = null; render(); },
  newMail: () => openModal('mail', { from: '', org: '', email: '', subject: '', body: '', area: ui.mailArea !== 'All' && areaOf(ui.mailArea) ? ui.mailArea : firstArea() }),
  editMail: el => { const m = byId(state.mail, el.dataset.id); if (m) openModal('mail', { ...m }, { id: m.id }); },
  deleteMail: () => { const id = ui.modal.id; closeModal(); ui.mailOpen = false; change(() => { state.mail = state.mail.filter(m => m.id !== id); }, 'Email removed', true); },
  mailDone: el => { ui.mailOpen = false; ui.mailSel = null; change(() => { state.mail = state.mail.filter(m => m.id !== el.dataset.id); }, 'Marked done', true); },
  mailSnooze: el => { ui.mailOpen = false; ui.mailSel = null; const t = addDays(today(), 1); t.setHours(9, 0, 0, 0); change(() => { const m = byId(state.mail, el.dataset.id); if (m) m.snooze = t.toISOString(); }, 'Snoozed until tomorrow, 9 am', true); },
  mailUnsnooze: el => change(() => { const m = byId(state.mail, el.dataset.id); if (m) m.snooze = null; ui.mailArea = 'All'; }, 'Back in your list'),
  mailTodo: el => change(() => { const m = byId(state.mail, el.dataset.id); if (m) addTodo('Reply: ' + (m.subject || m.from), m.area, todayStr()); }, 'Added to to-dos · due today', true),
  mailDraft: el => change(() => { const m = byId(state.mail, el.dataset.id); if (m) m.draft = `Hi ${(m.from || '').split(' ')[0]}, thanks for this. I'll come back to you properly by end of day.\n\n${state.name || ''}`.trim(); }),
  mailDiscard: el => change(() => { const m = byId(state.mail, el.dataset.id); if (m) m.draft = null; }, 'Draft discarded', true),
  mailCopy: el => { const m = byId(state.mail, el.dataset.id); if (!m) return; (navigator.clipboard ? navigator.clipboard.writeText(m.draft || '') : Promise.reject()).then(() => toast('Draft copied'), () => toast('Could not copy. Select the text and copy it.')); },
  mailSend: el => {
    const m = byId(state.mail, el.dataset.id); if (!m) return;
    const subj = /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject;
    location.href = `mailto:${encodeURIComponent(m.email || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(m.draft || '')}`;
    ui.mailOpen = false; ui.mailSel = null;
    change(() => { state.mail = state.mail.filter(x => x.id !== m.id); }, 'Opened in your mail app and marked done', true);
  },

  moneyTab: el => { ui.moneyTab = el.dataset.v; render(); },
  monthMove: el => { ui.monthOff += +el.dataset.n; render(); },
  monthNow: () => { ui.monthOff = 0; render(); },
  newMoney: () => openMoney(null, null),
  editMoney: el => openMoney(el.dataset.src, el.dataset.id),
  deleteMoney: () => { const { id, src } = ui.modal; closeModal(); change(() => { if (src === 'rec') state.recurring = state.recurring.filter(r => r.id !== id); else state.entries = state.entries.filter(r => r.id !== id); }, src === 'rec' ? 'Removed, including past months' : 'Deleted', true); },
  stopMoney: () => { const { id } = ui.modal; closeModal(); change(() => { const r = byId(state.recurring, id); if (r) r.end = ymd(addDays(today(), -1)); }, 'Stopped. Past months keep their history.', true); },
  reviewSub: el => {
    const r = byId(state.recurring, el.dataset.id); if (!r) return;
    const next = nextOccurrence(r); const key = r.id + ':' + (next ? ymd(next) : '');
    if (state.reviewed[key]) return;
    const due = next ? (dayDiff(today(), next) <= 1 ? today() : addDays(next, -1)) : today();
    change(() => { state.reviewed[key] = true; addTodo(`Review ${r.name} subscription · ${money(perMonth(r))}/mo`, r.area, ymd(due)); }, `To-do added: review ${r.name}`, true);
  },

  setTheme: el => { state.theme = el.dataset.v; save(); render(); },
  setAccent: el => { state.accent = el.dataset.v; save(); render(); },
  addArea: () => {
    const nm = ($('#newArea').value || '').trim().slice(0, 30);
    if (!nm) return;
    if (areaOf(nm)) { toast('That area already exists'); return; }
    const palette = ['#D2553F', '#3C7A89', '#8A6D3B', '#5A6ACF', '#2E8B57', '#B0577A', '#7A4FD0'];
    change(() => state.areas.push({ name: nm, color: palette[state.areas.length % palette.length] }), `Added ${nm}`);
  },
  removeArea: el => {
    const a = state.areas[+el.dataset.i]; if (!a) return;
    const used = state.todos.some(t => t.area === a.name) || state.ideas.some(t => t.area === a.name) || state.events.some(t => t.area === a.name) || state.mail.some(t => t.area === a.name);
    if (used && !confirm(`Remove ${a.name}? Items in it keep the name but lose their colour.`)) return;
    change(() => { state.areas.splice(+el.dataset.i, 1); }, `Removed ${a.name}`, true);
  },
  exportData: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `desk-backup-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  },
  importData: () => pickFile('application/json,.json', txt => {
    let data; try { data = JSON.parse(txt); } catch (e) { toast('That file isn’t a Desk backup'); return; }
    if (!data || typeof data !== 'object' || !Array.isArray(data.todos)) { toast('That file isn’t a Desk backup'); return; }
    if (!confirm('Replace everything in Desk with this backup?')) return;
    change(() => { state = { ...fresh(), ...data, welcomed: true }; }, 'Backup imported', true);
  }),
  loadSample: () => { if (!confirm('Replace your current data with sample data? You can undo straight after.')) return; change(() => { state = sample(); }, 'Sample data loaded', true); },
  eraseAll: () => { if (!confirm('Erase everything in Desk on this device?')) return; change(() => { const keep = { theme: state.theme, accent: state.accent, name: state.name }; state = { ...fresh(), ...keep, welcomed: true }; }, 'Everything erased', true); },
  importIcs: () => { const area = $('#icsArea').value; pickFile('.ics,text/calendar', txt => {
    let evs; try { evs = importICS(txt, area); } catch (e) { toast('Could not read that calendar file'); return; }
    if (!evs.length) { toast('No events found in that file'); return; }
    change(() => { state.icsArea = area; state.events = state.events.filter(e => e.src !== 'ics').concat(evs); }, `Imported ${plural(evs.length, 'event')}`, true);
  }); },
  clearIcs: () => change(() => { state.events = state.events.filter(e => e.src !== 'ics'); }, 'Imported events removed', true),

  closeModal: () => closeModal(),
  scrim: (el, e) => { if (e.target === el) closeModal(); },
  mPick: el => { syncModal(); ui.modal.data[el.dataset.k] = el.dataset.v; if (el.dataset.k === 'dir') ui.modal.data.kind = el.dataset.v === 'in' ? 'inc' : (ui.modal.data.kind === 'inc' ? 'spend' : ui.modal.data.kind); if (el.dataset.k === 'due') { const c = $('#mform [name=dueCustom]'); if (c) c.value = ''; } rerenderModal(); },
  searchGo: el => {
    const { type, id } = el.dataset; closeModal();
    if (type === 'todo') { go('tasks'); A.editTodo({ dataset: { id } }); }
    else if (type === 'idea') { go('tasks'); A.editIdea({ dataset: { id } }); }
    else if (type === 'event') { const v = byId(state.events, id); if (v) ui.calDate = fromYmd(v.date); go('calendar'); A.editEvent({ dataset: { id } }, { stopPropagation() {} }); }
    else if (type === 'mail') { const m = byId(state.mail, id); ui.mailArea = m && m.snooze && new Date(m.snooze) > new Date() ? '__snoozed' : 'All'; ui.mailSel = id; ui.mailOpen = true; go('mail'); }
    else { if (type === 'entry') { const e = byId(state.entries, id); if (e) { const d = fromYmd(e.date), t = today(); ui.monthOff = (d.getFullYear() - t.getFullYear()) * 12 + d.getMonth() - t.getMonth(); } } go('money'); openMoney(type === 'entry' ? 'entry' : 'rec', id); }
  },
};

/* ---------- modal submit ---------- */
function submitModal() {
  syncModal();
  const M = ui.modal, d = M.data;
  const area = areaOf(d.area) ? d.area : firstArea();
  if (M.type === 'capture') {
    const text = (d.text || '').trim(); if (!text) { $('#mform [name=text]').focus(); return; }
    closeModal(); ui.capArea = area;
    if (d.kind === 'task') change(() => addTodo(text, area, d.due || null), `Added to to-dos · ${area}${d.due ? ' · ' + dueLabel({ due: d.due }).toLowerCase() : ''}`, true);
    else change(() => addIdea(text, area), `Saved to Ideas inbox · ${area}`, true);
  } else if (M.type === 'todo') {
    const title = (d.title || '').trim(); if (!title) return;
    closeModal(); change(() => { const t = byId(state.todos, M.id); if (t) Object.assign(t, { title, area, due: d.due || null }); });
  } else if (M.type === 'idea') {
    const text = (d.text || '').trim(); if (!text) return;
    closeModal(); change(() => { const i = byId(state.ideas, M.id); if (i) Object.assign(i, { text, area }); });
  } else if (M.type === 'event') {
    const title = (d.title || '').trim(); if (!title || !d.date) { toast('Add a title and a date'); return; }
    let start = d.allDay ? '00:00' : (d.start || '09:00'), end = d.allDay ? '23:59' : (d.end || '');
    if (!d.allDay && (!end || end <= start)) { const h = Math.min(hrs(start) + 1, 24); end = h >= 24 ? '24:00' : `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`; }
    const rec = { title, where: (d.where || '').trim(), date: d.date, start, end, allDay: !!d.allDay, area };
    closeModal();
    change(() => { if (M.id) { const v = byId(state.events, M.id); if (v) Object.assign(v, rec); } else state.events.push({ id: uid(), ...rec }); }, M.id ? 'Event saved' : `Added · ${fmtDDM(fromYmd(d.date))}`);
  } else if (M.type === 'mail') {
    const from = (d.from || '').trim(), subject = (d.subject || '').trim();
    if (!from || !subject) { toast('Add who it’s from and a subject'); return; }
    const rec = { from, org: (d.org || '').trim(), email: (d.email || '').trim(), subject, body: d.body || '', area };
    closeModal();
    change(() => { if (M.id) { const m = byId(state.mail, M.id); if (m) Object.assign(m, rec); } else { const m = { id: uid(), added: new Date().toISOString(), draft: null, snooze: null, ...rec }; state.mail.push(m); ui.mailSel = m.id; } }, M.id ? 'Saved' : 'Added to Mail');
  } else if (M.type === 'money') {
    const amt = parseFloat(String(d.amount).replace(/[$,\s]/g, ''));
    const name = (d.name || '').trim();
    if (!name || !isFinite(amt) || amt <= 0 || !d.date) { toast('Add a name, an amount above zero and a date'); return; }
    const amount = Math.round(amt * 100) / 100 * (d.dir === 'in' ? 1 : -1);
    const kind = d.dir === 'in' ? 'inc' : (['spend', 'bill', 'sub'].includes(d.kind) ? d.kind : 'spend');
    const base = { name, note: (d.note || '').trim(), area, amount, kind };
    closeModal();
    change(() => {
      if (M.id) { if (M.src === 'rec') state.recurring = state.recurring.filter(r => r.id !== M.id); else state.entries = state.entries.filter(r => r.id !== M.id); }
      const id = M.id || uid();
      if (d.repeat === 'none') state.entries.push({ id, date: d.date, ...base });
      else state.recurring.push({ id, start: d.date, freq: d.repeat, day: fromYmd(d.date).getDate(), end: d.end || null, ...base });
    }, M.id ? 'Saved' : 'Added', true);
  }
}

/* ---------- events wiring ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault();
  fn(el, e);
});
document.addEventListener('submit', e => { if (e.target.id === 'mform') { e.preventDefault(); if (ui.modal && ui.modal.type !== 'search') submitModal(); } });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'draft') { const m = byId(state.mail, t.dataset.id); if (m) { m.draft = t.value; save(); } }
  else if (t.name === 'q' && ui.modal && ui.modal.type === 'search') { ui.modal.data.q = t.value; $('#results').innerHTML = searchResults(t.value); }
  else if (t.id === 'setName') { state.name = t.value.trim(); save(); const w = $('.brand .who'); if (w) w.textContent = state.name; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.change === 'areaColor') { const a = state.areas[+t.dataset.i]; if (a) { a.color = okColor(t.value); save(); render(); } }
  else if (t.dataset.change === 'mAllDay' || t.dataset.change === 'mRepeat') rerenderModal();
  else if (t.name === 'dueCustom' && t.value) { syncModal(); ui.modal.data.due = t.value; rerenderModal(); }
  else if (t.id === 'capArea') ui.capArea = t.value;
});
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (ui.modal) closeModal(); startCapture(); return; }
  if (mod && e.key === '/') { e.preventDefault(); A.search(); return; }
  if (e.key === 'Escape') { if (ui.modal) { closeModal(); return; } if (document.activeElement && document.activeElement.id === 'cap') document.activeElement.blur(); }
  const t = e.target;
  if (t.id === 'cap') {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); capSave(); }
    else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); ui.capType = ui.capType === 'task' ? 'idea' : 'task'; render(); }
  } else if (ui.modal && ui.modal.type === 'capture' && t.name === 'text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitModal(); }
  else if (ui.modal && ui.modal.type === 'search' && e.key === 'Enter') { e.preventDefault(); const first = $('#results .res'); if (first) first.click(); }
  else if (t.id === 'newArea' && e.key === 'Enter') { e.preventDefault(); A.addArea(); }
});
window.addEventListener('storage', e => { if (e.key === KEY) { state = load(); render(); } });
let lastMinute = new Date().getMinutes();
setInterval(() => {
  const m = new Date().getMinutes(); if (m === lastMinute) return; lastMinute = m;
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT') && ($('#cap') && $('#cap').value || ae.id === 'draft' || ae.id === 'setName' || ae.id === 'newArea' || ae.id === 'welcomeName');
  if (!ui.modal && !typing) render();
}, 15000);
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!ui.modal) render(); }, 150); });

/* ---------- boot ---------- */
ui.page = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

})();
