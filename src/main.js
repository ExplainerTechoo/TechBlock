const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execFile, execFileSync, spawn } = require('child_process');
const QRCode = require('qrcode');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const STORE_FILE = path.join(DATA_DIR, 'techblock-store.json');

let mainWindow = null;
let store = {};

function isAdmin() {
  try {
    const result = execFileSync('net', ['session'], { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

function relaunchAsAdmin() {
  const ps = "Start-Process -FilePath '\"" + process.execPath + "\"' -Verb RunAs";
  exec(ps, () => {});
  setTimeout(() => app.exit(0), 1500);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  ensureDataDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch (e) {
    store = {};
  }
  if (!store.settings) store.settings = {};
  if (!store.blockedSites) store.blockedSites = [];
  if (!store.blockedApps) store.blockedApps = [];
  if (!store.history) store.history = [];
  if (!store.notes) store.notes = [];
  if (!store.leaderboard) store.leaderboard = [];
  if (!store.totalPoints) store.totalPoints = 0;
  if (!store.users) store.users = {};
  if (!store.userStats) store.userStats = {};
  if (!store.comments) store.comments = [];
}

function formatTimeSpent(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function saveStore() {
  ensureDataDir();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('Failed to save store:', e);
  }
}

function resetStore() {
  ensureDataDir();
  try {
    store.settings = {};
    store.blockedSites = [];
    store.blockedApps = [];
    store.history = [];
    store.notes = [];
    store.leaderboard = [];
    store.totalPoints = 0;
    store.users = {};
    store.userStats = {};
    store.comments = [];
    saveStore();
  } catch (e) {
    console.error('Failed to reset store:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: 'TechBlock - Focus & Productivity',
    backgroundColor: '#0f1424',
    icon: path.join(process.resourcesPath || __dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function setupAutoUpdater() {
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';
  
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    mainWindow.webContents.send('update-downloaded', info);
  });

  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify();

  // Check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
}

/* ---------------- Website blocking via HOSTS file ---------------- */

function domainFromUrl(input) {
  let url = String(input || '').trim().toLowerCase();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let host;
  try { host = new URL(url).hostname; } catch (e) { host = url.replace(/^https?:\/\//, '').split(/[/\s]/)[0]; }
  host = host.replace(/^www\./, '');
  host = host.replace(/[^a-z0-9.\-]/g, '');
  if (!host || !host.includes('.') || host.split('.').some(p => !p)) return null;
  return host;
}

function hostsContent() {
  return fs.readFileSync(HOSTS_PATH, 'utf8');
}

function isHostBlocked(domain) {
  try {
    const content = hostsContent();
    const lines = content.split(/\r?\n/);
    return lines.some(l => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return false;
      const parts = t.split(/\s+/);
      return parts.length >= 2 && parts[1] === domain;
    });
  } catch (e) {
    return false;
  }
}

function blockHosts(domain) {
  try {
    let content = hostsContent();
    const ipv4 = `0.0.0.0 ${domain}`;
    const ipv6 = `:: ${domain}`;
    if (!content.split(/\r?\n/).some(l => l.trim().startsWith(ipv4))) {
      content = content.replace(/\r?\n?$/, '') + `\n${ipv4}\n`;
    }
    if (!content.split(/\r?\n/).some(l => l.trim().startsWith(ipv6))) {
      content = content.replace(/\r?\n?$/, '') + `\n${ipv6}\n`;
    }
    fs.writeFileSync(HOSTS_PATH, content);
    return { ok: true, domain };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function unblockHosts(domain) {
  try {
    let content = hostsContent();
    const lines = content.split(/\r?\n/);
    const kept = lines.filter(l => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return true;
      const parts = t.split(/\s+/);
      return !(parts.length >= 2 && parts[1] === domain);
    });
    const changed = kept.length !== lines.length;
    if (changed) fs.writeFileSync(HOSTS_PATH, kept.join('\n'));
    return { ok: true, domain, changed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function flushDns() {
  exec('ipconfig /flushdns', () => {});
}

/* -------- Firewall blocking (works even with Secure DNS/DoH) -------- */

function ruleNameFor(domain) {
  return 'TechBlock_' + String(domain).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
}

function getDomainIps(domain) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command',
      `Resolve-DnsName -Name "${domain}" -Type A -Server 8.8.8.8 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress} | Select-Object -ExpandProperty IPAddress`
    ], { timeout: 15000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const ips = String(stdout).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      resolve(ips);
    });
  });
}

function firewallRemove(domain) {
  exec(`netsh advfirewall firewall delete rule name="${ruleNameFor(domain)}"`, () => {});
}

async function firewallBlock(domain) {
  firewallRemove(domain);
  const ips = await getDomainIps(domain);
  for (const ip of ips) {
    exec(`netsh advfirewall firewall add rule name="${ruleNameFor(domain)}" dir=out action=block remoteip="${ip}" profile=any`, () => {});
  }
  return ips;
}

async function firewallUnblock(domain) {
  firewallRemove(domain);
}

function getActiveSiteBlocks() {
  const now = Date.now();
  const active = store.blockedSites
    .map(b => {
      const remaining = (b.until || 0) - now;
      return { ...b, remaining: Math.max(0, remaining), active: remaining > 0 };
    });
  // auto-expire
  const expired = store.blockedSites.filter(b => (b.until || 0) <= now);
  const still = store.blockedSites.filter(b => (b.until || 0) > now);
  if (still.length !== store.blockedSites.length) {
    store.blockedSites = still;
    saveStore();
  }
  for (const b of expired) firewallUnblock(b.domain);
  return active;
}

/* ---------------- App blocking ---------------- */

function getInstalledApps() {
  return new Promise((resolve) => {
    const ps = [
      'Get-ItemProperty',
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*,',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*,',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      '-ErrorAction SilentlyContinue',
      '| Where-Object { $_.DisplayName -and ($_.DisplayIcon -or $_.InstallLocation) }',
      '| Select-Object DisplayName, DisplayIcon, InstallLocation',
      '| ConvertTo-Json -Compress'
    ].join(' ');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { maxBuffer: 1024 * 1024 * 50 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      let parsed;
      try { parsed = JSON.parse(stdout); } catch (e) { return resolve([]); }
      if (!parsed) return resolve([]);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const seen = new Set();
      const apps = [];
      for (const item of list) {
        let exePath = (item.DisplayIcon || '').trim();
        if (!exePath) {
          const loc = (item.InstallLocation || '').trim();
          if (!loc) continue;
          exePath = loc;
        }
        exePath = exePath.replace(/^"|"$/g, '');
        if (exePath.endsWith(',0')) exePath = exePath.slice(0, -2);
        if (!exePath.toLowerCase().endsWith('.exe')) {
          const guess = path.join(exePath, path.basename(item.DisplayName).replace(/[^a-zA-Z0-9 ]/g, '') + '.exe');
          exePath = guess;
        }
        const exeName = path.basename(exePath).toLowerCase();
        if (!exeName.endsWith('.exe')) continue;
        if (seen.has(exeName)) continue;
        seen.add(exeName);
        apps.push({
          name: item.DisplayName,
          exeName,
          exePath,
          icon: item.DisplayIcon || ''
        });
      }
      apps.sort((a, b) => a.name.localeCompare(b.name));
      resolve(apps);
    });
  });
}

function killProcess(exeName) {
  exec(`taskkill /F /IM "${exeName}"`, () => {});
}

function denyExecute(exePath, deny) {
  const cmd = deny
    ? `icacls "${exePath}" /deny Everyone:(RX)`
    : `icacls "${exePath}" /remove:d Everyone`;
  exec(cmd, () => {});
}

function expireAppBlocks() {
  const now = Date.now();
  const expired = store.blockedApps.filter(a => (a.until || 0) <= now);
  if (expired.length) {
    for (const a of expired) {
      if (a.exePath) denyExecute(a.exePath, false);
      if (a.exeName) killProcess(a.exeName);
    }
    store.blockedApps = store.blockedApps.filter(a => (a.until || 0) > now);
    saveStore();
  }
  return expired.length > 0;
}

let watcher = null;
let watcherRunning = false;
function ensureWatcher() {
  if (watcherRunning) return;
  watcherRunning = true;
  watcher = setInterval(() => {
    expireAppBlocks();
    const now = Date.now();
    let expired = false;
    for (const a of store.blockedApps) {
      if ((a.until || 0) <= now) { expired = true; break; }
    }
    if (expired) {
      for (const a of store.blockedApps) {
        if ((a.until || 0) <= now && a.exeName) killProcess(a.exeName);
      }
    }
  }, 3000);
}

function getActiveAppBlocks() {
  expireAppBlocks();
  const now = Date.now();
  const active = store.blockedApps.map(b => ({
    ...b,
    remaining: Math.max(0, (b.until || 0) - now),
    active: (b.until || 0) > now
  }));
  return active;
}

/* ---------------- QR Code ---------------- */

const DOWNLOAD_URL = 'https://github.com/ExplainerTechoo/TechBlock';

function generateQR(text) {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(text || DOWNLOAD_URL, { width: 400, margin: 2, color: { dark: '#0f1424', light: '#ffffff' } })
      .then(resolve)
      .catch(reject);
  });
}

/* ---------------- IPC ---------------- */

function registerIpc() {
  ipcMain.handle('store:get', (e, key) => store[key] || null);
  ipcMain.handle('store:set', (e, key, value) => { store[key] = value; saveStore(); return true; });
  ipcMain.handle('storage:grant', (e, granted) => {
    store.settings.storageGranted = granted;
    saveStore();
    return true;
  });
  ipcMain.handle('storage:status', () => store.settings.storageGranted === true);

  ipcMain.handle('apps:list', async () => {
    try { return await getInstalledApps(); } catch (e) { return []; }
  });

  ipcMain.handle('site:block', async (e, input, minutes) => {
    const domain = domainFromUrl(input);
    if (!domain) return { ok: false, error: 'Invalid URL / domain' };
    const until = Date.now() + minutes * 60000;
    const exists = store.blockedSites.find(b => b.domain === domain);
    if (exists) {
      exists.until = until;
      exists.minutes = minutes;
      exists.startedAt = Date.now();
    } else {
      store.blockedSites.push({ domain, minutes, until, startedAt: Date.now() });
    }
    const res = blockHosts(domain);
    const ips = await firewallBlock(domain);
    flushDns();
    if (res.ok) saveStore();
    else store.blockedSites = store.blockedSites.filter(b => b.domain !== domain);
    return { ...res, until, ips };
  });

  ipcMain.handle('site:unblock', async (e, domain) => {
    const res = unblockHosts(domain);
    await firewallUnblock(domain);
    store.blockedSites = store.blockedSites.filter(b => b.domain !== domain);
    flushDns();
    saveStore();
    return res;
  });

  ipcMain.handle('sites:list', () => getActiveSiteBlocks());

  ipcMain.handle('sites:blockedCheck', async (e, input) => {
    const domain = domainFromUrl(input);
    if (!domain) return { blocked: false };
    return { blocked: isHostBlocked(domain), domain };
  });

  ipcMain.handle('sites:test', async (e, input) => {
    const domain = domainFromUrl(input);
    if (!domain) return { ok: false };
    const ips = await new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-Command',
        `Resolve-DnsName -Name "${domain}" -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress} | Select-Object -ExpandProperty IPAddress`
      ], { timeout: 15000 }, (err, stdout) => resolve(err || !stdout ? [] : String(stdout).split(/\r?\n/).map(s => s.trim()).filter(Boolean)));
    });
    const blocked = ips.length > 0 && ips.every(ip => ip === '0.0.0.0' || ip === '::' || ip === '::1' || ip === '127.0.0.1');
    return { ok: true, domain, ips, blocked };
  });

  ipcMain.handle('app:block', async (e, app, minutes) => {
    const until = Date.now() + minutes * 60000;
    const exists = store.blockedApps.find(a => a.exeName === app.exeName);
    if (exists) {
      exists.until = until;
      exists.minutes = minutes;
      exists.startedAt = Date.now();
    } else {
      store.blockedApps.push({ ...app, minutes, until, startedAt: Date.now() });
    }
    denyExecute(app.exePath, true);
    killProcess(app.exeName);
    ensureWatcher();
    saveStore();
    return { ok: true, until };
  });

  ipcMain.handle('app:unblock', async (e, app) => {
    store.blockedApps = store.blockedApps.filter(a => a.exeName !== app.exeName);
    denyExecute(app.exePath, false);
    saveStore();
    return { ok: true };
  });

  ipcMain.handle('apps:blocked', () => getActiveAppBlocks());
  ipcMain.handle('process:kill', (e, exeName) => { killProcess(exeName); return true; });

  ipcMain.handle('history:add', (e, entry) => {
    store.history.push({ ...entry, at: Date.now() });
    if (store.history.length > 5000) store.history = store.history.slice(-5000);
    saveStore();
    return true;
  });

  ipcMain.handle('qr:generate', async (e, text) => {
    try { return { ok: true, dataUrl: await generateQR(text) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

/* ---------------- Local Auth, Stats, Comments & Admin ---------------- */
  ipcMain.handle('auth:login', async (e, email, password) => {
    if (!store.users) store.users = {};
    const user = Object.values(store.users).find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, error: 'Invalid email or password' };
    return { ok: true, user: { id: user.id, email: user.email, username: user.username || null } };
  });

  ipcMain.handle('auth:signup', async (e, email, password, username) => {
    if (!store.users) store.users = {};
    if (Object.values(store.users).some(u => u.email === email)) {
      return { ok: false, error: 'Email already registered' };
    }
    if (username && Object.values(store.users).some(u => u.username === username)) {
      return { ok: false, error: 'Username already taken' };
    }
    const id = crypto.randomUUID();
    const user = { id, email, username: username || null, password, createdAt: Date.now() };
    store.users[id] = user;
    saveStore();
    return { ok: true, user: { id, email, username: user.username } };
  });

  ipcMain.handle('auth:setUsername', async (e, userId, email, username) => {
    if (!store.users || !store.users[userId]) return { ok: false, error: 'User not found' };
    if (Object.values(store.users).some(u => u.username === username && u.id !== userId)) {
      return { ok: false, error: 'Username already taken' };
    }
    store.users[userId].username = username;
    saveStore();
    return { ok: true, username };
  });

  ipcMain.handle('auth:deleteAccount', async (e, userId) => {
    if (!store.users || !store.users[userId]) return { ok: false, error: 'User not found' };
    delete store.users[userId];
    saveStore();
    return { ok: true };
  });

  ipcMain.handle('stats:sync', async (e, userId, stats) => {
    if (!store.userStats) store.userStats = {};
    store.userStats[userId] = { ...stats, updatedAt: Date.now() };
    saveStore();
    return { ok: true };
  });

  ipcMain.handle('stats:get', async (e, userId) => {
    if (!store.userStats || !store.userStats[userId]) return { ok: true, stats: null };
    return { ok: true, stats: store.userStats[userId] };
  });

  ipcMain.handle('comments:get', async () => {
    return store.comments || [];
  });

  ipcMain.handle('comments:add', async (e, userId, username, content) => {
    if (!store.comments) store.comments = [];
    const comment = { id: crypto.randomUUID(), userId, username: username || 'Anonymous', content, createdAt: Date.now() };
    store.comments.unshift(comment);
    if (store.comments.length > 500) store.comments = store.comments.slice(0, 500);
    saveStore();
    return { ok: true, comment };
  });

  // Admin config from env only
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const MASTER_ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || '';

  ipcMain.handle('admin:verify', (e, email, password) => {
    if (!email || !password) return false;
    const cleanEmail = email.trim().toLowerCase();
    return ADMIN_EMAILS.includes(cleanEmail) && password === MASTER_ADMIN_PASSWORD;
  });

  ipcMain.handle('admin:getAnalytics', async (e, email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(cleanEmail) || password !== MASTER_ADMIN_PASSWORD) {
      return { ok: false, error: 'Unauthorized' };
    }
    const users = store.users ? Object.values(store.users) : [];
    const userStats = store.userStats || {};
    return {
      ok: true,
      analytics: {
        totalRegisteredUsers: users.length,
        totalTimeSpentSeconds: Object.values(userStats).reduce((sum, s) => sum + (s.timeSpentSeconds || 0), 0),
        totalPointsAccumulated: Object.values(userStats).reduce((sum, s) => sum + (s.points || 0), 0),
        activeUserTrends: { todayActive: users.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length, totalFlaggedUsers: 0 }
      },
      userTable: users.map(u => {
        const stats = userStats[u.id] || {};
        return { id: u.id, username: u.username || 'No Username', email: u.email, streaks: stats.streakCount || 0, points: stats.points || 0, timeSpentSeconds: stats.timeSpentSeconds || 0, formattedTimeSpent: formatTimeSpent(stats.timeSpentSeconds || 0), isFlagged: false, flagReason: null, createdAt: u.createdAt };
      }),
      leaderboard: users.map(u => {
        const stats = userStats[u.id] || {};
        return { username: u.username || 'Anonymous', streaks: stats.streakCount || 0, points: stats.points || 0, timeSpentSeconds: stats.timeSpentSeconds || 0, isFlagged: false };
      }).sort((a, b) => b.points - a.points || b.streaks - a.streaks)
    };
  });

  ipcMain.handle('leaderboard:getPublic', async () => {
    const users = store.users ? Object.values(store.users) : [];
    const userStats = store.userStats || {};
    return users.map(u => {
      const stats = userStats[u.id] || {};
      return { username: u.username || 'Anonymous', streaks: stats.streakCount || 0, points: stats.points || 0, timeSpentSeconds: stats.timeSpentSeconds || 0, isFlagged: false };
    }).sort((a, b) => b.points - a.points || b.streaks - a.streaks).slice(0, 50);
  });

  ipcMain.handle('feedback:email', () => {
    shell.openExternal('mailto:support@techblock.app?subject=TechBlock%20Feedback');
    return true;
  });

  ipcMain.handle('store:reset', () => {
    resetStore();
    return true;
  });
}

/* ---------------- Startup ---------------- */

app.whenReady().then(() => {
  const noElevate = process.env.TECHBLOCK_NO_ELEVATE === '1';
  if (!isAdmin() && !noElevate) {
    relaunchAsAdmin();
    return;
  }
  loadStore();
  registerIpc();
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
