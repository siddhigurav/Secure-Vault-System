/**
 * Secure Vault System - Frontend Application
 */

// =====================================================
// STATE MANAGEMENT
// =====================================================
const state = {
  token: localStorage.getItem('vault_token'),
  user: null,
  currentView: 'dashboard',
  secrets: [],
  policies: [],
  auditLogs: []
};

// =====================================================
// API CLIENT
// =====================================================
const API_BASE = '/api';

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// =====================================================
// AUTHENTICATION
// =====================================================
async function login(username, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('vault_token', data.token);

  return data;
}

async function logout() {
  try {
    await apiCall('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  }

  state.token = null;
  state.user = null;
  localStorage.removeItem('vault_token');
  showPage('login');
}

async function getCurrentUser() {
  const data = await apiCall('/auth/me');
  state.user = data.user;
  return data.user;
}

// =====================================================
// SECRETS API
// =====================================================
async function listSecrets(filters = {}) {
  const params = new URLSearchParams(filters);
  const data = await apiCall(`/secrets?${params}`);
  state.secrets = data.secrets;
  return data.secrets;
}

async function createSecret(secretData) {
  return await apiCall('/secrets', {
    method: 'POST',
    body: JSON.stringify(secretData)
  });
}

async function getSecret(path) {
  return await apiCall(`/secrets/${path}`);
}

async function revealSecret(path) {
  return await apiCall(`/secrets/${path}/reveal`);
}

async function deleteSecret(path) {
  return await apiCall(`/secrets/${path}`, { method: 'DELETE' });
}

// =====================================================
// POLICIES API
// =====================================================
async function listPolicies() {
  const data = await apiCall('/policies');
  state.policies = data.policies;
  return data.policies;
}

// =====================================================
// AUDIT API
// =====================================================
async function listAuditLogs(filters = {}) {
  const params = new URLSearchParams(filters);
  const data = await apiCall(`/audit?${params}`);
  state.auditLogs = data.logs;
  return data.logs;
}

async function exportAuditLogs(filters = {}) {
  const params = new URLSearchParams(filters);
  window.open(`${API_BASE}/audit/export?${params}`, '_blank');
}

// =====================================================
// UI HELPERS
// =====================================================
function showLoading() {
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('hidden');
  }
}

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  const targetPage = pageName === 'login' ? 'login-page' : 'main-app';
  document.getElementById(targetPage).classList.add('active');
}

function showView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  document.getElementById(`${viewName}-view`).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

  // Load view data
  loadViewData(viewName);
}

async function loadViewData(viewName) {
  showLoading();
  try {
    switch (viewName) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'secrets':
        await loadSecrets();
        break;
      case 'policies':
        await loadPolicies();
        break;
      case 'audit':
        await loadAuditLogs();
        break;
    }
  } catch (error) {
    console.error('Error loading view:', error);
  } finally {
    hideLoading();
  }
}

// =====================================================
// DASHBOARD
// =====================================================
async function loadDashboard() {
  const [secrets, policies, logs] = await Promise.all([
    listSecrets({ limit: 10 }),
    listPolicies(),
    listAuditLogs({ limit: 10 })
  ]);

  document.getElementById('stat-secrets').textContent = secrets.length;
  document.getElementById('stat-roles').textContent = state.user.roles.length;
  document.getElementById('stat-policies').textContent = policies.length;

  const activityList = document.getElementById('recent-activity-list');
  activityList.innerHTML = logs.map(log => `
    <div class="audit-item">
      <div><strong>${log.action}</strong> on ${log.resource_path || 'system'}</div>
      <div class="secret-meta">
        <span>${log.username}</span>
        <span>${new Date(log.timestamp).toLocaleString()}</span>
        <span class="${log.result === 'success' ? 'text-success' : 'text-danger'}">${log.result}</span>
      </div>
    </div>
  `).join('');
}

// =====================================================
// SECRETS VIEW
// =====================================================
async function loadSecrets() {
  const secrets = await listSecrets();
  renderSecretsList(secrets);
}

function renderSecretsList(secrets) {
  const list = document.getElementById('secrets-list');

  if (secrets.length === 0) {
    list.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">No secrets found. Create your first secret to get started.</p>';
    return;
  }

  list.innerHTML = secrets.map(secret => `
    <div class="secret-item" data-path="${secret.path}">
      <div class="secret-path">${secret.path}</div>
      <div class="secret-description">${secret.description || 'No description'}</div>
      <div class="secret-meta">
        <span>Version ${secret.version}</span>
        <span>Created by ${secret.created_by_username}</span>
        <span>${new Date(secret.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');

  // Add click handlers
  list.querySelectorAll('.secret-item').forEach(item => {
    item.addEventListener('click', () => {
      showSecretDetail(item.dataset.path);
    });
  });
}

async function showSecretDetail(path) {
  showLoading();
  try {
    const { secret } = await getSecret(path);
    const modal = document.getElementById('secret-detail-modal');
    const content = document.getElementById('secret-detail-content');

    content.innerHTML = `
      <div style="padding: var(--spacing-xl);">
        <div class="form-group">
          <label>Path</label>
          <div style="font-family: monospace; color: var(--color-accent-primary);">${secret.path}</div>
        </div>
        <div class="form-group">
          <label>Value (Masked)</label>
          <div style="font-family: monospace; background: var(--color-bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md);">
            ${secret.value}
          </div>
          <button id="reveal-secret-btn" class="btn btn-secondary" style="margin-top: var(--spacing-sm);">Reveal Secret</button>
        </div>
        <div class="form-group">
          <label>Description</label>
          <div>${secret.description || 'No description'}</div>
        </div>
        <div class="form-group">
          <label>Metadata</label>
          <div class="secret-meta">
            <span>Version ${secret.version}</span>
            <span>Created by ${secret.createdBy}</span>
            <span>${new Date(secret.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button id="delete-secret-btn" class="btn btn-danger">Delete Secret</button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    // Reveal button handler
    document.getElementById('reveal-secret-btn').addEventListener('click', async () => {
      try {
        showLoading();
        const { secret: revealed } = await revealSecret(path);
        const valueDiv = content.querySelector('.form-group:nth-child(2) div[style*="monospace"]');
        valueDiv.textContent = revealed.value;
        valueDiv.style.color = 'var(--color-accent-warning)';

        // Auto-hide after 30 seconds
        setTimeout(() => {
          valueDiv.textContent = secret.value;
          valueDiv.style.color = '';
        }, 30000);
      } catch (error) {
        alert('Failed to reveal secret: ' + error.message);
      } finally {
        hideLoading();
      }
    });

    // Delete button handler
    document.getElementById('delete-secret-btn').addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete secret "${path}"?`)) {
        try {
          showLoading();
          await deleteSecret(path);
          modal.classList.add('hidden');
          loadSecrets();
        } catch (error) {
          alert('Failed to delete secret: ' + error.message);
        } finally {
          hideLoading();
        }
      }
    });
  } catch (error) {
    alert('Failed to load secret: ' + error.message);
  } finally {
    hideLoading();
  }
}

// =====================================================
// POLICIES VIEW
// =====================================================
async function loadPolicies() {
  const policies = await listPolicies();
  const list = document.getElementById('policies-list');

  if (policies.length === 0) {
    list.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">No policies found.</p>';
    return;
  }

  list.innerHTML = policies.map(policy => `
    <div class="policy-item">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <div class="secret-path">${policy.name}</div>
          <div style="color: var(--color-text-secondary); margin: var(--spacing-sm) 0;">${policy.description || 'No description'}</div>
        </div>
        <span style="padding: var(--spacing-xs) var(--spacing-md); background: ${policy.effect === 'allow' ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 71, 87, 0.2)'}; color: ${policy.effect === 'allow' ? 'var(--color-accent-primary)' : 'var(--color-accent-danger)'}; border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: 600;">
          ${policy.effect.toUpperCase()}
        </span>
      </div>
      <div class="secret-meta">
        <span>Roles: ${policy.roles.join(', ')}</span>
        <span>Actions: ${policy.actions.join(', ')}</span>
        <span>Resources: ${policy.resources.join(', ')}</span>
      </div>
    </div>
  `).join('');
}

// =====================================================
// AUDIT LOGS VIEW
// =====================================================
async function loadAuditLogs(filters = {}) {
  const logs = await listAuditLogs(filters);
  const list = document.getElementById('audit-logs-list');

  if (logs.length === 0) {
    list.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">No audit logs found.</p>';
    return;
  }

  list.innerHTML = logs.map(log => `
    <div class="audit-item">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <div><strong>${log.action}</strong></div>
          <div style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
            ${log.resource_path || 'N/A'}
          </div>
        </div>
        <span style="padding: var(--spacing-xs) var(--spacing-md); background: ${log.result === 'success' ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 71, 87, 0.2)'}; color: ${log.result === 'success' ? 'var(--color-accent-primary)' : 'var(--color-accent-danger)'}; border-radius: var(--radius-sm); font-size: var(--font-size-sm);">
          ${log.result}
        </span>
      </div>
      <div class="secret-meta">
        <span>${log.username}</span>
        <span>${log.ip_address || 'N/A'}</span>
        <span>${new Date(log.timestamp).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
}

// =====================================================
// EVENT HANDLERS
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('login-error');
    showLoading();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      await login(username, password);
      document.getElementById('user-display').textContent = state.user.username;
      showPage('main');
      showView('dashboard');
    } catch (error) {
      showError('login-error', error.message);
    } finally {
      hideLoading();
    }
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showView(link.dataset.view);
    });
  });

  // Create secret button
  document.getElementById('create-secret-btn').addEventListener('click', () => {
    document.getElementById('secret-modal').classList.remove('hidden');
  });

  // Secret form
  document.getElementById('secret-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const secretData = {
      path: document.getElementById('secret-path').value,
      value: document.getElementById('secret-value').value,
      description: document.getElementById('secret-description').value,
      tags: document.getElementById('secret-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      await createSecret(secretData);
      document.getElementById('secret-modal').classList.add('hidden');
      document.getElementById('secret-form').reset();
      loadSecrets();
    } catch (error) {
      alert('Failed to create secret: ' + error.message);
    } finally {
      hideLoading();
    }
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
      });
    });
  });

  // Secret search
  document.getElementById('secret-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = state.secrets.filter(s => s.path.toLowerCase().includes(query));
    renderSecretsList(filtered);
  });

  // Audit filters
  document.getElementById('apply-audit-filters').addEventListener('click', () => {
    const filters = {
      action: document.getElementById('audit-filter-action').value,
      resourcePath: document.getElementById('audit-filter-resource').value
    };
    loadAuditLogs(filters);
  });

  // Export audit logs
  document.getElementById('export-audit-btn').addEventListener('click', () => {
    exportAuditLogs();
  });

  // Initialize app
  if (state.token) {
    getCurrentUser().then(() => {
      document.getElementById('user-display').textContent = state.user.username;
      showPage('main');
      showView('dashboard');
    }).catch(() => {
      logout();
    });
  } else {
    showPage('login');
  }
});
