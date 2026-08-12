const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('techblock', {
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
  grantStorage: (granted) => ipcRenderer.invoke('storage:grant', granted),
  storageStatus: () => ipcRenderer.invoke('storage:status'),

  listApps: () => ipcRenderer.invoke('apps:list'),

  blockSite: (input, minutes) => ipcRenderer.invoke('site:block', input, minutes),
  unblockSite: (domain) => ipcRenderer.invoke('site:unblock', domain),
  listSites: () => ipcRenderer.invoke('sites:list'),
  checkSiteBlocked: (input) => ipcRenderer.invoke('sites:blockedCheck', input),
  testSiteBlock: (input) => ipcRenderer.invoke('sites:test', input),

  blockApp: (app, minutes) => ipcRenderer.invoke('app:block', app, minutes),
  unblockApp: (app) => ipcRenderer.invoke('app:unblock', app),
  listBlockedApps: () => ipcRenderer.invoke('apps:blocked'),
  killProcess: (exeName) => ipcRenderer.invoke('process:kill', exeName),

  addHistory: (entry) => ipcRenderer.invoke('history:add', entry),
  generateQR: (text) => ipcRenderer.invoke('qr:generate', text),

  aiStatus: () => ipcRenderer.invoke('ai:status'),
  aiAsk: (message) => ipcRenderer.invoke('ai:ask', message),

  // Auth, Onboarding & User
  login: (email, pass) => ipcRenderer.invoke('auth:login', email, pass),
  signUp: (email, pass, username) => ipcRenderer.invoke('auth:signup', email, pass, username),
  setUsername: (userId, email, username) => ipcRenderer.invoke('auth:setUsername', userId, email, username),
  deleteAccount: (userId) => ipcRenderer.invoke('auth:deleteAccount', userId),

  // State Persistence & Stats
  syncStats: (userId, stats) => ipcRenderer.invoke('stats:sync', userId, stats),
  getStats: (userId) => ipcRenderer.invoke('stats:get', userId),

  // Comments
  getComments: () => ipcRenderer.invoke('comments:get'),
  addComment: (userId, username, content) => ipcRenderer.invoke('comments:add', userId, username, content),

  // Admin & Analytics
  verifyAdmin: (email, pass) => ipcRenderer.invoke('admin:verify', email, pass),
  getAdminAnalytics: (email, pass) => ipcRenderer.invoke('admin:getAnalytics', email, pass),
  getPublicLeaderboard: () => ipcRenderer.invoke('leaderboard:getPublic'),

  // Feedback Mail
  openEmailClient: () => ipcRenderer.invoke('feedback:email')
});
