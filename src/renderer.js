const api = window.techblock;
const $ = (id) => document.getElementById(id);

/* ---------------- State ---------------- */
let state = {
  currentUser: null, // { id, email, username, role }
  sites: [],
  apps: [],
  blockedApps: [],
  notes: [],
  history: [],
  totalPoints: 0,
  timeSpentSeconds: 0,
  storageGranted: false,
  adminAuth: null // { email, password }
};

const DOWNLOAD_URL = 'https://github.com/ExplainerTechoo/TechBlock';

/* ---------------- Navigation ---------------- */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const targetPage = $('page-' + btn.dataset.page);
    if (targetPage) targetPage.classList.add('active');

    if (btn.dataset.page === 'comments') loadCommentsFeed();
    if (btn.dataset.page === 'admin' && state.adminAuth) loadAdminDashboard();
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

/* ---------------- Toast Notification ---------------- */
function showToast(message) {
  const toast = $('toast-alert');
  const msgEl = $('toast-message');
  if (msgEl) msgEl.textContent = message;
  if (toast) {
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }
}

/* ---------------- Helpers ---------------- */
function saveState() {
  api.storeSet('notes', state.notes);
  api.storeSet('history', state.history);
  api.storeSet('totalPoints', state.totalPoints);
  api.storeSet('timeSpentSeconds', state.timeSpentSeconds);
  if (state.currentUser) api.storeSet('currentUser', state.currentUser);
  
  // Trigger Supabase persistence sync if logged in
  syncUserMetrics();
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

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- User Session & Onboarding ---------------- */
async function initUserSession() {
  const storedUser = await api.storeGet('currentUser');
  if (storedUser && storedUser.id) {
    state.currentUser = storedUser;
    
    // Fetch user stats from Supabase (Persistence Rule: Never wipe metrics on logout or start)
    const remoteStats = await api.getStats(storedUser.id);
    if (remoteStats) {
      state.totalPoints = Math.max(state.totalPoints, remoteStats.points || 0);
      state.timeSpentSeconds = Math.max(state.timeSpentSeconds, remoteStats.timeSpentSeconds || 0);
    }
    
    // Check if username is set; if not, trigger onboarding username modal
    if (!storedUser.username) {
      showUsernameModal();
    }
  }
  updateUserUI();
}

function updateUserUI() {
  const uName = $('user-display-name');
  const uEmail = $('user-display-email');
  const uAuthBtn = $('user-auth-btn');
  const commentUsername = $('comment-active-username');

  const setAccStatus = $('settings-account-status');
  const setUsername = $('settings-username');
  const setEmail = $('settings-email');
  const setLoginBtn = $('settings-login-btn');
  const setLogoutBtn = $('settings-logout-btn');

  if (state.currentUser) {
    const dispName = state.currentUser.username || 'Logged In User';
    uName.textContent = dispName;
    uEmail.textContent = 'Synced & Saved';
    if (uAuthBtn) uAuthBtn.innerHTML = '<span class="u-login-ico">🚪</span>';
    if (commentUsername) commentUsername.textContent = dispName;

    if (setAccStatus) setAccStatus.textContent = 'Authenticated (Synced to Supabase)';
    if (setUsername) setUsername.textContent = state.currentUser.username || 'Not set';
    if (setEmail) setEmail.textContent = 'Private (Hidden in public views)';
    if (setLoginBtn) setLoginBtn.classList.add('hidden');
    if (setLogoutBtn) setLogoutBtn.classList.remove('hidden');
  } else {
    uName.textContent = 'Guest User';
    uEmail.textContent = 'Sign in to sync';
    if (uAuthBtn) uAuthBtn.innerHTML = '<span class="u-login-ico">🔑</span>';
    if (commentUsername) commentUsername.textContent = 'Guest';

    if (setAccStatus) setAccStatus.textContent = 'Guest Mode (Local Device)';
    if (setUsername) setUsername.textContent = 'Not set';
    if (setEmail) setEmail.textContent = 'Private';
    if (setLoginBtn) setLoginBtn.classList.remove('hidden');
    if (setLogoutBtn) setLogoutBtn.classList.add('hidden');
  }
}

function showUsernameModal() {
  $('username-modal').classList.remove('hidden');
}

$('username-submit-btn').addEventListener('click', async () => {
  const input = $('username-input').value.trim();
  const errDiv = $('username-error');
  errDiv.classList.add('hidden');

  if (!input || input.length < 3) {
    errDiv.textContent = 'Username must be at least 3 characters long.';
    errDiv.classList.remove('hidden');
    return;
  }

  if (state.currentUser) {
    const res = await api.setUsername(state.currentUser.id, state.currentUser.email, input);
    if (!res.ok) {
      errDiv.textContent = res.error || 'Failed to set username.';
      errDiv.classList.remove('hidden');
      return;
    }
    state.currentUser.username = res.username;
    api.storeSet('currentUser', state.currentUser);
    updateUserUI();
  }
  $('username-modal').classList.add('hidden');
});

/* ---------------- Auth Modal Handlers ---------------- */
let isSignUpMode = false;

$('user-auth-btn').addEventListener('click', () => {
  if (state.currentUser) {
    logoutUser();
  } else {
    showAuthModal();
  }
});

$('settings-login-btn').addEventListener('click', showAuthModal);
$('settings-logout-btn').addEventListener('click', logoutUser);

function showAuthModal() {
  $('auth-modal').classList.remove('hidden');
}

$('auth-close-btn').addEventListener('click', () => {
  $('auth-modal').classList.add('hidden');
});

$('auth-toggle-btn').addEventListener('click', () => {
  isSignUpMode = !isSignUpMode;
  $('auth-title').textContent = isSignUpMode ? 'Create New Account' : 'Sign In';
  $('auth-submit-btn').textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  $('auth-toggle-btn').textContent = isSignUpMode ? 'Already have an account? Sign In' : 'Need an account? Sign Up';
  if (isSignUpMode) {
    $('auth-username').classList.remove('hidden');
  } else {
    $('auth-username').classList.add('hidden');
  }
  $('auth-error').classList.add('hidden');
});

$('auth-submit-btn').addEventListener('click', async () => {
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value.trim();
  const username = $('auth-username').value.trim();
  const errDiv = $('auth-error');
  errDiv.classList.add('hidden');

  if (!email || !password) {
    errDiv.textContent = 'Please provide both email and password.';
    errDiv.classList.remove('hidden');
    return;
  }

  if (isSignUpMode && !username) {
    errDiv.textContent = 'Please choose a unique username for Sign Up.';
    errDiv.classList.remove('hidden');
    return;
  }

  let res;
  if (isSignUpMode) {
    res = await api.signUp(email, password, username);
  } else {
    res = await api.login(email, password);
  }

  if (!res.ok) {
    errDiv.textContent = res.error || 'Authentication failed.';
    errDiv.classList.remove('hidden');
    return;
  }

  state.currentUser = res.user;
  api.storeSet('currentUser', state.currentUser);
  
  // Sync metrics from Supabase
  const remoteStats = await api.getStats(res.user.id);
  if (remoteStats) {
    state.totalPoints = Math.max(state.totalPoints, remoteStats.points || 0);
    state.timeSpentSeconds = Math.max(state.timeSpentSeconds, remoteStats.timeSpentSeconds || 0);
  }

  updateUserUI();
  $('auth-modal').classList.add('hidden');
  logHistory('🔑', `Signed in as ${res.user.username || res.user.email}`, 'Session active');
});

function logoutUser() {
  // Persistence Rule: Do NOT wipe local or remote metrics on logout!
  state.currentUser = null;
  api.storeSet('currentUser', null);
  updateUserUI();
  logHistory('🚪', 'Logged out', 'Local session closed');
}

/* ---------------- Double Confirmation Account Deletion ---------------- */
$('settings-delete-account-btn').addEventListener('click', () => {
  if (!state.currentUser) {
    alert('Please sign in to manage account deletion.');
    return;
  }
  $('delete-modal-step1').classList.remove('hidden');
});

$('delete-step1-cancel').addEventListener('click', () => {
  $('delete-modal-step1').classList.add('hidden');
});

$('delete-step1-continue').addEventListener('click', () => {
  $('delete-modal-step1').classList.add('hidden');
  $('delete-modal-step2').classList.remove('hidden');
});

$('delete-step2-cancel').addEventListener('click', () => {
  $('delete-modal-step2').classList.add('hidden');
});

$('delete-step2-confirm').addEventListener('click', async () => {
  if (!state.currentUser) return;
  const userId = state.currentUser.id;
  const res = await api.deleteAccount(userId);
  $('delete-modal-step2').classList.add('hidden');

  if (res.ok) {
    alert('Account deleted successfully. All profile metrics purged cleanly.');
    state.currentUser = null;
    state.totalPoints = 0;
    state.notes = [];
    state.history = [];
    api.storeSet('currentUser', null);
    saveState();
    updateUserUI();
    renderTasks();
    renderHistory();
    renderStats();
  } else {
    alert('Could not delete account: ' + (res.error || 'Server error'));
  }
});

/* ---------------- State Syncing to Supabase ---------------- */
async function syncUserMetrics() {
  if (!state.currentUser) return;
  const statsPayload = {
    streakCount: calcStreak(),
    points: state.totalPoints,
    timeSpentSeconds: state.timeSpentSeconds
  };
  await api.syncStats(state.currentUser.id, statsPayload);
}

// Automatically increment usage time and sync every 15 seconds
setInterval(() => {
  state.timeSpentSeconds += 1;
}, 1000);

setInterval(() => {
  saveState();
}, 15000);

/* ---------------- Home & Stats ---------------- */
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
  
  // Show reset button
  const resetBtn = $('reset-data-btn');
  if (resetBtn) {
    resetBtn.style.display = 'inline-block';
    resetBtn.onclick = () => {
      if (confirm('This will DELETE ALL user data: notes, tasks, history, blocked sites/apps, stats, comments. This cannot be undone. Are you sure?')) {
        api.storeSet('notes', []);
        api.storeSet('history', []);
        api.storeSet('totalPoints', 0);
        api.storeSet('timeSpentSeconds', 0);
        api.storeSet('currentUser', null);
        state.notes = [];
        state.history = [];
        state.totalPoints = 0;
        state.timeSpentSeconds = 0;
        state.currentUser = null;
        $('notes-points').textContent = '0';
        $('sidebar-points').textContent = '0';
        renderStats();
        showTip('🗑 All data reset. TechBlock feels fresh like a new account.');
      }
    };
  }
}
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
  showTip('🔒 Site blocked!' + ipNote + '\n\nIf it still opens in a browser, restart the browser once to clear DNS cache.');
  return res;
}

function showTip(message) {
  const tip = $('app-tip');
  if (tip) { tip.textContent = message; tip.style.display = 'block'; }
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
        <button class="btn btn-ghost" data-unblock="${esc(s.domain)}" disabled title="Cannot unblock before timer ends">Unblock</button>
      </div>
    </div>`).join('');
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

const APP_ICONS = { chrome: '🟢', firefox: '🦊', edge: '🌀', code: '💻', discord: '💬', spotify: '🎵', zoom: '🎥', whatsapp: '💚', steam: '🎮' };

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
    toggle.addEventListener('change', async () => {
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

// ---------------- Notes -----------------
$('note-add-btn').addEventListener('click', () => {
  const text = $('note-text').value.trim();
  if (!text) { alert('Write your note first.'); return; }
  state.notes.push({ id: Date.now(), text, done: false, doneAt: null });
  logHistory('📝', `Added note "${text}"`, '+10 pts');
  $('note-text').value = '';
  saveState();
  renderNotes();
});

function renderNotes() {
  const box = $('note-list');
  if (!state.notes.length) { box.innerHTML = '<p class="muted">No notes yet. Add your first note above!</p>'; return; }
  box.innerHTML = state.notes.slice().reverse().map(n => {
    const completed = n.done ? `Done ${fmtDate(n.doneAt)} · +10 pts` : `Started ${fmtDate(n.startedAt)}`;
    return `
    <div class="task-card ${n.done ? 'completed' : ''}" data-id="${n.id}">
      <div class="task-body">
        <div class="t-text">${esc(n.text)}</div>
        <div class="t-meta">${completed}</div>
      </div>
      ${n.done ? `<div class="task-points">+10 pts</div>` : ''}
      <button class="task-del" title="Delete note">🗑</button>
    </div>`;
  }).join('');

  box.querySelectorAll('.task-circle').forEach(c => {
    // Note: task-circle handlers for tasks, notes use task-del for delete
  });

  box.querySelectorAll('.task-del').forEach(c => {
    c.addEventListener('click', () => {
      const card = c.closest('.task-card');
      const note = state.notes.find(n => String(n.id) === card.dataset.id);
      if (!note) return;
      state.notes = state.notes.filter(n => n.id !== note.id);
      logHistory('📝', `Deleted note "${note.text}"`);
      saveState();
      renderNotes();
    });
  });
});

/* ---------------- Feedback & Community Comments ---------------- */
function showFeedbackModal() {
  $('feedback-choice-modal').classList.remove('hidden');
}

$('feedback-close-btn').addEventListener('click', () => {
  $('feedback-choice-modal').classList.add('hidden');
});

$('trigger-feedback-modal-btn').addEventListener('click', showFeedbackModal);
$('about-feedback-btn').addEventListener('click', showFeedbackModal);

$('feedback-option-email').addEventListener('click', () => {
  $('feedback-choice-modal').classList.add('hidden');
  api.openEmailClient();
});

$('feedback-option-comment').addEventListener('click', () => {
  $('feedback-choice-modal').classList.add('hidden');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-page="comments"]').classList.add('active');
  $('page-comments').classList.add('active');
  loadCommentsFeed();
});

async function loadCommentsFeed() {
  const box = $('comments-feed');
  box.innerHTML = '<p class="muted">Loading community comments...</p>';
  const comments = await api.getComments();
  if (!comments || !comments.length) {
    box.innerHTML = '<p class="muted">No public comments yet. Be the first to share your thoughts!</p>';
    return;
  }
  box.innerHTML = comments.map(c => `
    <div class="comment-card">
      <div class="comment-header">
        <span class="comment-author"><span>👤</span> ${esc(c.username)}</span>
        <span class="comment-time">${fmtDate(new Date(c.created_at).getTime())}</span>
      </div>
      <div class="comment-body">${esc(c.content)}</div>
    </div>`).join('');
}

$('refresh-comments-btn').addEventListener('click', loadCommentsFeed);

$('comment-post-btn').addEventListener('click', async () => {
  const content = $('comment-input').value.trim();
  if (!content) { alert('Please enter your comment text.'); return; }

  const userId = state.currentUser ? state.currentUser.id : null;
  const username = state.currentUser ? (state.currentUser.username || 'Anonymous') : 'Guest User';

  const res = await api.addComment(userId, username, content);

  if (!res.ok) {
    if (res.abusive) {
      // Abusive language alert toast
      showToast('Abusive language is strictly prohibited.');
    } else {
      alert('Could not post comment: ' + (res.error || 'Server error'));
    }
    return;
  }

  $('comment-input').value = '';
  await loadCommentsFeed();
});

/* ---------------- Strict Admin Dashboard (`/admin`) ---------------- */
$('admin-login-btn').addEventListener('click', async () => {
  const email = $('admin-email-input').value.trim();
  const password = $('admin-password-input').value.trim();
  const errDiv = $('admin-auth-error');
  errDiv.classList.add('hidden');

  if (!email || !password) {
    errDiv.textContent = 'Please provide admin email and master password.';
    errDiv.classList.remove('hidden');
    return;
  }

  const isValid = await api.verifyAdmin(email, password);
  if (!isValid) {
    errDiv.textContent = 'Unauthorized: Invalid Admin Email or Master Password.';
    errDiv.classList.remove('hidden');
    return;
  }

  state.adminAuth = { email, password };
  $('admin-active-email').textContent = email;
  $('admin-gate-panel').classList.add('hidden');
  $('admin-dashboard-content').classList.remove('hidden');
  await loadAdminDashboard();
});

$('admin-logout-btn').addEventListener('click', () => {
  state.adminAuth = null;
  $('admin-gate-panel').classList.remove('hidden');
  $('admin-dashboard-content').classList.add('hidden');
  $('admin-email-input').value = '';
  $('admin-password-input').value = '';
});

async function loadAdminDashboard() {
  if (!state.adminAuth) return;
  const res = await api.getAdminAnalytics(state.adminAuth.email, state.adminAuth.password);

  if (!res.ok) {
    alert('Admin Error: ' + res.error);
    return;
  }

  const { analytics, userTable, leaderboard } = res;

  // 1. Analytics Cards
  $('admin-total-users').textContent = analytics.totalRegisteredUsers;
  $('admin-total-time').textContent = analytics.formattedTotalTimeSpent;
  $('admin-total-pts').textContent = analytics.totalPointsAccumulated;
  $('admin-flagged-count').textContent = analytics.activeUserTrends.totalFlaggedUsers;

  // 2. User Table (Email visible ONLY to Admin)
  const tBody = $('admin-user-table-body');
  if (!userTable || !userTable.length) {
    tBody.innerHTML = '<tr><td colspan="6" class="muted text-center">No registered users found.</td></tr>';
  } else {
    tBody.innerHTML = userTable.map(u => `
      <tr>
        <td><b>${esc(u.username)}</b></td>
        <td><code>${esc(u.email)}</code></td>
        <td>🔥 ${u.streaks} days</td>
        <td>⭐ ${u.points} pts</td>
        <td>⏱ ${u.formattedTimeSpent}</td>
        <td>
          ${u.isFlagged
            ? `<span class="flagged-badge">⚠️ Flagged (${esc(u.flagReason)})</span>`
            : `<span class="clean-badge">✅ Verified Clean</span>`}
        </td>
      </tr>`).join('');
  }

  // 3. Leaderboard & Anti-Cheat Engine
  const lBody = $('admin-leaderboard-body');
  if (!leaderboard || !leaderboard.length) {
    lBody.innerHTML = '<tr><td colspan="6" class="muted text-center">No rankings data available.</td></tr>';
  } else {
    lBody.innerHTML = leaderboard.map((l, idx) => `
      <tr>
        <td><b>#${idx + 1}</b></td>
        <td>${esc(l.username)}</td>
        <td>🔥 ${l.streaks} days</td>
        <td>⭐ ${l.points} pts</td>
        <td>⏱ ${Math.floor(l.timeSpentSeconds / 60)}m</td>
        <td>
          ${l.isFlagged
            ? `<span class="flagged-badge">Anomaly Flagged</span>`
            : `<span class="clean-badge">Valid Pattern</span>`}
        </td>
      </tr>`).join('');
  }
}

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
  const before = state.sites.length + state.blockedApps.length;
  state.sites = state.sites.filter(s => (s.until || 0) > now);
  state.blockedApps = state.blockedApps.filter(a => (a.until || 0) > now);
  if (before !== state.sites.length + state.blockedApps.length) {
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
  const [notes, history, totalPoints, timeSpentSeconds] = await Promise.all([
    api.storeGet('notes'),
    api.storeGet('history'),
    api.storeGet('totalPoints'),
    api.storeGet('timeSpentSeconds')
  ]);
  state.notes = notes || [];
  state.history = history || [];
  state.totalPoints = totalPoints || 0;
  state.timeSpentSeconds = timeSpentSeconds || 0;

  renderTasks();
  renderHistory();
  await refreshSites();
  await loadApps();
  renderStats();
  initQR();
  await initUserSession();
})();
