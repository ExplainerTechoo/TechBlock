const api = window.techblock;
const $ = (id) => document.getElementById(id);

/* ---------------- State ---------------- */
let state = {
  sites: [],
  apps: [],
  blockedApps: [],
  notes: [],
  history: [],
  totalPoints: 0,
  storageGranted: false
};

const DOWNLOAD_URL = 'https://github.com/ExplainerTechoo/TechBlock';

/* ---------------- Navigation ---------------- */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('page-' + btn.dataset.page).classList.add('active');
  });
});

/* ---------------- Storage permission ---------------- */
async function initStoragePermission() {
  state.storageGranted = await api.storageStatus();
  if (state.storageGranted !== true) {
    $('permission-overlay').classList.remove('hidden');
  } else {
    $('permission-overlay').classList.add('hidden');
  }
}

$('perm-allow').addEventListener('click', async () => {
  await api.grantStorage(true);
  state.storageGranted = true;
  $('permission-overlay').classList.add('hidden');
});

$('perm-deny').addEventListener('click', () => {
  $('permission-overlay').classList.add('hidden');
});

/* ---------------- Helpers ---------------- */
function saveState() {
  api.storeSet('notes', state.notes);
  api.storeSet('history', state.history);
  api.storeSet('totalPoints', state.totalPoints);
}

async function logHistory(ico, text, sub) {
  const entry = { ico, text, sub, at: Date.now() };
  state.history.push(entry);
  if (state.history.length > 5000) state.history = state.history.slice(-5000);
  await api.addHistory(entry);
  renderHistory();
}

function fmtDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getDate()}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtRemain(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}h ${pad(m)}m ${pad(sec)}s` : `${m}m ${pad(sec)}s`;
}

/* ---------------- Home ---------------- */
function renderStats() {
  const doneCount = state.notes.filter(n => n.done).length;
  $('stat-sites').textContent = state.sites.filter(s => s.active).length;
  $('stat-apps').textContent = state.blockedApps.filter(a => a.active).length;
  $('stat-tasks').textContent = doneCount;
  $('stat-points').textContent = state.totalPoints;
  $('sidebar-points').textContent = state.totalPoints;
  $('notes-points').textContent = state.totalPoints;
  $('sidebar-streak').textContent = calcStreak();
  $('notes-streak').textContent = calcStreak();
}

function renderHomeActive() {
  const active = state.sites.filter(s => s.active).concat(
    state.blockedApps.filter(a => a.active).map(a => ({ domain: a.name + ' (App)', until: a.until }))
  );
  const box = $('home-active-blocks');
  if (!active.length) { box.innerHTML = '<p class="muted">No active blocks.</p>'; return; }
  box.innerHTML = active.slice(0, 6).map(s => `
    <div class="block-item">
      <div>
        <div class="b-name">${esc(s.domain)}</div>
        <div class="b-info">Unlocks in <span class="timer" data-until="${s.until}">${fmtRemain(s.until - Date.now())}</span></div>
      </div>
    </div>`).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- Website Blocker ---------------- */
async function blockSite(input, minutes) {
  if (!input.trim()) return { ok: false, error: 'Please enter a site or link.' };
  if (!minutes || minutes < 1) return { ok: false, error: 'Please enter a valid time in minutes.' };
  const res = await api.blockSite(input, minutes);
  if (!res.ok) {
    alert('Could not block site: ' + (res.error || 'Make sure you run TechBlock as Administrator.'));
    return res;
  }
  await logHistory('🌐', `Blocked ${res.domain}`, `for ${minutes} min · unlocks ${fmtDate(Date.now() + minutes * 60000)}`);
  await refreshSites();
  const ipNote = res.ips && res.ips.length ? ` (blocked IPs: ${res.ips.join(', ')})` : '';
  showTip('🔒 Site blocked!' + ipNote + '\n\nIf it still opens in a browser, restart the browser once (or close & reopen the tab) so its DNS cache clears.\n\nIn Chrome/Edge/Firefox, turn OFF "Secure DNS / DNS-over-HTTPS" (Settings → Privacy → Security) so it respects the block. TechBlock also added a Firewall rule, so the site is now blocked even with Secure DNS on.');
  return res;
}

function showTip(message) {
  const tip = $('app-tip');
  if (tip) { tip.textContent = message; tip.style.display = 'block'; }
}

async function unblockSite(domain) {
  const res = await api.unblockSite(domain);
  await logHistory('🔓', `Unblocked ${domain}`, `timer finished · ${fmtDate(Date.now())}`);
  await refreshSites();
  return res;
}

async function refreshSites() {
  state.sites = await api.listSites();
  renderSites();
  renderHomeActive();
  renderStats();
}

function renderSites() {
  const box = $('site-list');
  const active = state.sites.filter(s => s.active);
  if (!active.length) { box.innerHTML = '<p class="muted">Nothing is blocked right now.</p>'; return; }
  box.innerHTML = active.map(s => `
    <div class="block-item">
      <div>
        <div class="b-name">🔒 ${esc(s.domain)}</div>
        <div class="b-info">Blocked at ${fmtDate(s.startedAt)} · unlocks ${fmtDate(s.until)} · <span class="timer" data-until="${s.until}">${fmtRemain(s.remaining)}</span> left</div>
      </div>
      <div class="b-right">
        <span class="timer-badge">BLOCKED</span>
        <button class="btn btn-ghost" data-unblock="${s.domain}" disabled title="Cannot unblock before timer ends">Unblock</button>
      </div>
    </div>`).join('');

  box.querySelectorAll('[data-unblock]').forEach(b => {
    b.disabled = true;
    b.title = 'Unblock is locked until the timer finishes.';
  });
}

$('site-block-btn').addEventListener('click', async () => {
  const input = $('site-url').value;
  const minutes = parseInt($('site-time').value, 10);
  await blockSite(input, minutes);
  $('site-url').value = '';
  $('site-time').value = '';
});

$('quick-block-btn').addEventListener('click', async () => {
  const input = $('quick-url').value;
  const minutes = parseInt($('quick-time').value, 10);
  const res = await blockSite(input, minutes);
  if (res.ok) $('quick-url').value = '';
});

$('site-url').addEventListener('keydown', e => { if (e.key === 'Enter') $('site-block-btn').click(); });

/* ---------------- App Blocker ---------------- */
async function loadApps() {
  $('apps-list').innerHTML = '<p class="muted">Loading installed apps...</p>';
  state.apps = await api.listApps();
  const blocked = await api.listBlockedApps();
  state.blockedApps = blocked;
  renderApps();
  renderBlockedApps();
  renderStats();
}

const APP_ICONS = { chrome: '🟢', firefox: '🦊', edge: '🌀', 'msedge': '🌀', 'msiexec': '⚙️', code: '💻', 'code.exe': '💻', discord: '💬', spotify: '🎵', zoom: '🎥', whatsapp: '💚', telegram: '✈️', slack: '💼', steam: '🎮', epic: '🎮', gamebar: '🎮', excel: '📊', winword: '📄', powerpnt: '📊', onenote: '📝', teams: '💼', outlook: '📧', photoshop: '🎨', vlc: '📺', obs: '🎬', capcut: '🎬', netflix: '🎬' };

function iconFor(exe) {
  for (const k in APP_ICONS) if (exe.includes(k)) return APP_ICONS[k];
  return '📦';
}

function renderApps() {
  const box = $('apps-list');
  if (!state.apps.length) { box.innerHTML = '<p class="muted">No apps found. Make sure TechBlock is running as Administrator.</p>'; return; }
  const q = ($('app-search').value || '').toLowerCase();
  const filtered = state.apps.filter(a => a.name.toLowerCase().includes(q) || a.exeName.toLowerCase().includes(q));
  if (!filtered.length) { box.innerHTML = '<p class="muted">No apps match your search.</p>'; return; }
  box.innerHTML = filtered.map(a => {
    const blocked = state.blockedApps.find(b => b.exeName === a.exeName);
    const isActive = blocked && blocked.active;
    return `
    <div class="app-item" data-exe="${esc(a.exeName)}">
      <div class="a-ico">${iconFor(a.exeName)}</div>
      <div class="a-name" title="${esc(a.exePath)}">${esc(a.name)}</div>
      ${isActive
        ? `<span class="timer-badge" data-until="${blocked.until}">${fmtRemain(blocked.remaining)}</span>`
        : `<div class="app-controls">
            <input type="number" class="a-timer-input" min="1" placeholder="min" title="Minutes to block">
            <label class="toggle"><input type="checkbox" data-toggle-app><span class="slider"></span></label>
          </div>`}
    </div>`;
  }).join('');

  box.querySelectorAll('input[data-toggle-app]').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const item = toggle.closest('.app-item');
      const app = state.apps.find(a => a.exeName === item.dataset.exe);
      const minutes = parseInt(item.querySelector('.a-timer-input').value, 10);
      if (!minutes || minutes < 1) { alert('Set a timer in minutes first.'); toggle.checked = false; return; }
      const res = await api.blockApp(app, minutes);
      if (res.ok) {
        await logHistory('📱', `Blocked ${app.name}`, `for ${minutes} min · unlocks ${fmtDate(res.until)}`);
        await loadApps();
      } else {
        alert('Could not block app. Run as Administrator.');
        toggle.checked = false;
      }
    });
  });
}

$('app-search').addEventListener('input', renderApps);
$('refresh-apps').addEventListener('click', loadApps);

function renderBlockedApps() {
  const box = $('app-blocked-list');
  const active = state.blockedApps.filter(a => a.active);
  if (!active.length) { box.innerHTML = '<p class="muted">No apps are blocked.</p>'; return; }
  box.innerHTML = active.map(a => `
    <div class="block-item">
      <div>
        <div class="b-name">📱 ${esc(a.name)}</div>
        <div class="b-info">Unlocks ${fmtDate(a.until)} · <span class="timer" data-until="${a.until}">${fmtRemain(a.remaining)}</span> left</div>
      </div>
      <span class="timer-badge">BLOCKED</span>
    </div>`).join('');
}

/* ---------------- Notes & Tasks ---------------- */
function calcResult(startedAt, setMin, doneAt) {
  const setMs = setMin * 60000;
  const elapsed = doneAt - startedAt;
  const diff = elapsed - setMs;
  if (elapsed <= setMs / 2) return { points: 11, color: 'green', label: 'Finished early! +11' };
  if (elapsed <= setMs) return { points: 10, color: 'yellow', label: 'On time! +10' };
  const late = Math.ceil(diff / 60000);
  if (late <= 10) return { points: 9, color: 'red', label: `${late} min late · +9` };
  if (late <= 20) return { points: 8, color: 'red', label: `${late} min late · +8` };
  if (late <= 30) return { points: 7, color: 'red', label: `${late} min late · +7` };
  return { points: 0, color: 'red', label: 'Too late · +0' };
}

function calcStreak() {
  const doneDays = new Set();
  state.notes.filter(n => n.done).forEach(n => {
    const d = new Date(n.doneAt);
    doneDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });
  let streak = 0;
  const cur = new Date();
  const today = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
  if (doneDays.has(today)) {
    let d = new Date(cur);
    while (doneDays.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) { streak++; d.setDate(d.getDate() - 1); }
  }
  return streak;
}

function renderTasks() {
  const box = $('task-list');
  if (!state.notes.length) { box.innerHTML = '<p class="muted">No tasks yet. Add your first task above!</p>'; return; }
  box.innerHTML = state.notes.slice().reverse().map(n => {
    const elapsed = n.done ? calcResult(n.startedAt, n.setMin, n.doneAt) : null;
    let timerHtml = '';
    if (!n.done) {
      const rem = (n.startedAt + n.setMin * 60000) - Date.now();
      timerHtml = `<div class="t-timer">⏳ <span class="timer" data-until="${n.startedAt + n.setMin * 60000}">${fmtRemain(rem)}</span> left · deadline ${fmtDate(n.startedAt + n.setMin * 60000)}</div>`;
    }
    return `
    <div class="task-card ${n.done ? 'completed ' + elapsed.color : ''}" data-id="${n.id}">
      <button class="task-circle" title="Mark complete"></button>
      <div class="task-body">
        <div class="t-text">${esc(n.text)}</div>
        <div class="t-meta">${n.done
          ? `Done ${fmtDate(n.doneAt)} · ${elapsed.label} · started ${fmtDate(n.startedAt)}`
          : `Started ${fmtDate(n.startedAt)} · time set ${n.setMin} min`}</div>
        ${timerHtml}
      </div>
      ${n.done ? `<div class="task-points">${elapsed.points > 0 ? '+' + elapsed.points : '0'}</div>` : ''}
      <button class="task-del" title="Delete task">🗑</button>
    </div>`;
  }).join('');

  box.querySelectorAll('.task-circle').forEach(c => {
    c.addEventListener('click', async () => {
      const card = c.closest('.task-card');
      const note = state.notes.find(n => String(n.id) === card.dataset.id);
      if (!note || note.done) return;
      note.done = true;
      note.doneAt = Date.now();
      const res = calcResult(note.startedAt, note.setMin, note.doneAt);
      state.totalPoints += res.points;
      await logHistory('📝', `Completed "${note.text}"`, `${res.label} → ${res.points} points`);
      saveState();
      renderTasks();
      renderStats();
    });
  });

  box.querySelectorAll('.task-del').forEach(d => {
    d.addEventListener('click', () => {
      const card = d.closest('.task-card');
      const note = state.notes.find(n => String(n.id) === card.dataset.id);
      if (!note) return;
      state.notes = state.notes.filter(n => n.id !== note.id);
      logHistory('🗑', `Deleted task "${note.text}"`, fmtDate(Date.now()));
      saveState();
      renderTasks();
    });
  });
}

$('task-add-btn').addEventListener('click', () => {
  const text = $('task-text').value.trim();
  const setMin = parseInt($('task-time').value, 10);
  if (!text) { alert('Write your task first.'); return; }
  if (!setMin || setMin < 1) { alert('Set the task time in minutes.'); return; }
  state.notes.push({ id: Date.now(), text, setMin, startedAt: Date.now(), done: false, doneAt: null });
  logHistory('📝', `Added task "${text}"`, `time set ${setMin} min`);
  $('task-text').value = '';
  $('task-time').value = '';
  saveState();
  renderTasks();
});

$('task-time').addEventListener('keydown', e => { if (e.key === 'Enter') $('task-add-btn').click(); });

/* ---------------- History ---------------- */
function renderHistory() {
  const box = $('history-list');
  if (!state.history.length) { box.innerHTML = '<p class="muted">No history yet.</p>'; return; }
  box.innerHTML = state.history.slice().reverse().map(h => `
    <div class="history-item">
      <div class="h-ico">${h.ico}</div>
      <div class="h-text">
        ${esc(h.text)}
        ${h.sub ? `<div class="h-sub">${esc(h.sub)}</div>` : ''}
      </div>
      <div class="h-time">${fmtDate(h.at)}</div>
    </div>`).join('');
}

$('clear-history').addEventListener('click', () => {
  if (!confirm('Clear all history?')) return;
  state.history = [];
  saveState();
  renderHistory();
});

/* ---------------- AI Assistant ---------------- */
async function initAI() {
  const res = await api.aiStatus();
  const dot = $('ai-dot');
  const txt = $('ai-status-text');
  if (res.version) {
    dot.classList.add('online'); dot.classList.remove('offline');
    txt.textContent = 'opencode connected · ' + res.version.trim();
  } else {
    dot.classList.add('offline'); dot.classList.remove('online');
    txt.textContent = 'opencode CLI not found on this PC';
    addChatMsg('To enable TechBlock AI, install opencode in a terminal and restart this app:\n\nnpm install -g opencode-ai\n\n(Windows 10 build 1803+ required. Then ask me to block any website or app!)', 'ai');
  }
}

function addChatMsg(text, who) {
  const box = $('ai-chat');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + who;
  div.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function sendAI() {
  const input = $('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  addChatMsg(msg, 'user');
  input.value = '';
  $('ai-send').disabled = true;
  addChatMsg('Thinking...', 'ai');
  const res = await api.aiAsk(msg);
  const box = $('ai-chat');
  box.lastElementChild.remove();
  if (res.error) {
    addChatMsg('⚠️ ' + res.error, 'error');
    addChatMsg('Tip: opencode AI needs to be installed on this PC. Try running "npm install -g opencode-ai" in terminal.', 'ai');
  } else {
    addChatMsg(res.text || '(no response)', 'ai');
  }
  $('ai-send').disabled = false;
}

$('ai-send').addEventListener('click', sendAI);
$('ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI(); }
});

/* ---------------- QR / Get App ---------------- */
async function initQR() {
  const res = await api.generateQR(DOWNLOAD_URL);
  const box = $('qr-box');
  if (res.ok) {
    box.innerHTML = `<img src="${res.dataUrl}" alt="TechBlock QR code">`;
    $('qr-target').textContent = DOWNLOAD_URL;
    $('dl-link').href = DOWNLOAD_URL;
  } else {
    box.innerHTML = '<p class="muted">Could not generate QR code.</p>';
  }
}

/* ---------------- Ticker ---------------- */
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.timer').forEach(el => {
    const until = parseInt(el.dataset.until, 10);
    el.textContent = fmtRemain(until - now);
  });
  document.querySelectorAll('.timer-badge[data-until]').forEach(el => {
    const until = parseInt(el.dataset.until, 10);
    el.textContent = fmtRemain(until - now);
  });

  // auto-unblock expired sites/apps
  let changed = false;
  const before = state.sites.length + state.blockedApps.length;
  state.sites = state.sites.filter(s => (s.until || 0) > now);
  state.blockedApps = state.blockedApps.filter(a => (a.until || 0) > now);
  if (before !== state.sites.length + state.blockedApps.length) {
    changed = true;
    api.listSites().then(live => {
      state.sites = live;
      renderSites(); renderHomeActive(); renderStats();
    });
    api.listBlockedApps().then(live => {
      state.blockedApps = live;
      renderApps(); renderBlockedApps(); renderStats();
    });
  }
}, 1000);

/* ---------------- Boot ---------------- */
(async function boot() {
  await initStoragePermission();
  const [notes, history, totalPoints] = await Promise.all([
    api.storeGet('notes'), api.storeGet('history'), api.storeGet('totalPoints')
  ]);
  state.notes = notes || [];
  state.history = history || [];
  state.totalPoints = totalPoints || 0;
  renderTasks();
  renderHistory();
  await refreshSites();
  await loadApps();
  renderStats();
  initAI();
  initQR();
})();
