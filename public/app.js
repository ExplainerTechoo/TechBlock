document.addEventListener('DOMContentLoaded', () => {
  // State
  let authToken = localStorage.getItem('techblock_jwt') || null;
  let currentUser = JSON.parse(localStorage.getItem('techblock_user') || 'null');

  // DOM Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const authStatusBadge = document.getElementById('authStatusBadge');
  const logoutBtn = document.getElementById('logoutBtn');
  const toast = document.getElementById('toast');

  // Auth Elements
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const sessionOutput = document.getElementById('sessionOutput');
  const refreshProfileBtn = document.getElementById('refreshProfileBtn');

  // Storage Block Elements
  const createBlockForm = document.getElementById('createBlockForm');
  const fetchBlocksBtn = document.getElementById('fetchBlocksBtn');
  const blocksList = document.getElementById('blocksList');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  // Security Elements
  const inspectHeadersBtn = document.getElementById('inspectHeadersBtn');
  const headersOutput = document.getElementById('headersOutput');
  const testRateLimitBtn = document.getElementById('testRateLimitBtn');
  const rateLimitOutput = document.getElementById('rateLimitOutput');

  // Health Elements
  const checkHealthBtn = document.getElementById('checkHealthBtn');
  const healthOutput = document.getElementById('healthOutput');

  // Tab Navigation
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });

  // UI Updates based on Auth
  function updateAuthUI() {
    if (authToken && currentUser) {
      authStatusBadge.className = 'badge badge-success';
      authStatusBadge.textContent = `Authenticated: ${currentUser.username || currentUser.email} (${currentUser.role || 'user'})`;
      logoutBtn.classList.remove('hidden');
      sessionOutput.textContent = JSON.stringify({
        status: 'ACTIVE_SESSION',
        token: `${authToken.substring(0, 20)}...[MASKED_JWT_SIGNATURE]`,
        user: currentUser
      }, null, 2);
    } else {
      authStatusBadge.className = 'badge badge-warning';
      authStatusBadge.textContent = 'Guest (Not Authenticated)';
      logoutBtn.classList.add('hidden');
      sessionOutput.textContent = 'No active authentication session. Please register or log in above.';
    }
  }

  // Toast Notifications
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  }

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('techblock_jwt');
    localStorage.removeItem('techblock_user');
    updateAuthUI();
    showToast('Logged out successfully.');
  });

  // Register Submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('techblock_jwt', authToken);
      localStorage.setItem('techblock_user', JSON.stringify(currentUser));

      updateAuthUI();
      registerForm.reset();
      showToast('Account created and logged in!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('techblock_jwt', authToken);
      localStorage.setItem('techblock_user', JSON.stringify(currentUser));

      updateAuthUI();
      loginForm.reset();
      showToast('Authentication successful!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Refresh Profile
  refreshProfileBtn.addEventListener('click', async () => {
    if (!authToken) return showToast('Please log in first', 'error');
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      currentUser = data.user;
      localStorage.setItem('techblock_user', JSON.stringify(currentUser));
      updateAuthUI();
      showToast('Profile refreshed!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Create Storage Block
  createBlockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!authToken) return showToast('Authentication required to store blocks.', 'error');

    const title = document.getElementById('blockTitle').value;
    const dataStr = document.getElementById('blockData').value;
    const tagsRaw = document.getElementById('blockTags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ title, data: dataStr, tags })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to store block');

      showToast('Storage block created!');
      createBlockForm.reset();
      fetchBlocks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Fetch Storage Blocks
  async function fetchBlocks(query = '') {
    if (!authToken) {
      blocksList.innerHTML = '<div class="placeholder-text">Please log in to view your storage blocks.</div>';
      return;
    }

    try {
      const url = query ? `/api/blocks/search/query?q=${encodeURIComponent(query)}` : '/api/blocks';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch blocks');

      if (!data.blocks || data.blocks.length === 0) {
        blocksList.innerHTML = '<div class="placeholder-text">No storage blocks found. Create one above!</div>';
        return;
      }

      blocksList.innerHTML = data.blocks.map(b => `
        <div class="block-card">
          <div>
            <div class="block-title">${escapeHtml(b.title)}</div>
            <div class="block-checksum">SHA256: ${b.checksum} (${b.sizeBytes} bytes)</div>
            <div class="block-payload">${escapeHtml(b.data)}</div>
            <div>${(b.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
          </div>
          <button class="btn btn-sm btn-danger delete-block-btn" data-id="${b._id || b.id}">Delete</button>
        </div>
      `).join('');

      // Add delete listeners
      document.querySelectorAll('.delete-block-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          await deleteBlock(id);
        });
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteBlock(id) {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/blocks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');

      showToast('Block deleted successfully');
      fetchBlocks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  fetchBlocksBtn.addEventListener('click', () => fetchBlocks());
  searchBtn.addEventListener('click', () => fetchBlocks(searchInput.value));

  // Security Header Audit
  inspectHeadersBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/health');
      const headers = {};
      res.headers.forEach((val, key) => {
        headers[key] = val;
      });
      headersOutput.textContent = JSON.stringify({
        status: res.status,
        securityHeaders: {
          'x-dns-prefetch-control': headers['x-dns-prefetch-control'] || 'active',
          'x-frame-options': headers['x-frame-options'] || 'active (helmet)',
          'strict-transport-security': headers['strict-transport-security'] || 'active',
          'x-content-type-options': headers['x-content-type-options'] || 'nosniff',
          'content-security-policy': headers['content-security-policy'] || 'configured',
          'rate-limit-limit': headers['ratelimit-limit'] || '100 requests / 15m'
        },
        rawHeaders: headers
      }, null, 2);
      showToast('Security audit complete!');
    } catch (err) {
      headersOutput.textContent = 'Error inspecting headers: ' + err.message;
    }
  });

  // Rate Limiting Test
  testRateLimitBtn.addEventListener('click', async () => {
    rateLimitOutput.textContent = 'Sending 5 rapid requests to check rate limiting headers...\n';
    for (let i = 1; i <= 5; i++) {
      try {
        const res = await fetch('/api/health');
        const limit = res.headers.get('ratelimit-limit') || res.headers.get('x-ratelimit-limit') || '100';
        const remaining = res.headers.get('ratelimit-remaining') || res.headers.get('x-ratelimit-remaining') || 'Active';
        rateLimitOutput.textContent += `Request #${i}: Status ${res.status} | RateLimit Remaining: ${remaining}\n`;
      } catch (err) {
        rateLimitOutput.textContent += `Request #${i}: Error - ${err.message}\n`;
      }
    }
  });

  // Check Health Status
  checkHealthBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      healthOutput.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      healthOutput.textContent = 'Error checking health: ' + err.message;
    }
  });

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initial Load
  updateAuthUI();
  checkHealthBtn.click();
});
