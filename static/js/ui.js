// UI Module - Handles DOM manipulation and user interface updates
class UI {
    constructor() {
        this.currentPage = 'dashboard';
        this.visibleSecrets = new Set();
        this.init();
    }

    // Initialize UI
    init() {
        this.bindEvents();
        this.updateUserInfo();
    }

    // Bind event listeners
    bindEvents() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // Navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', this.handleNavigation.bind(this));
        });

        // Add secret button
        const addSecretBtn = document.getElementById('add-secret-btn');
        if (addSecretBtn) {
            addSecretBtn.addEventListener('click', this.showSecretForm.bind(this));
        }

        // Secret form
        const secretForm = document.getElementById('secret-form-element');
        if (secretForm) {
            secretForm.addEventListener('submit', this.handleSecretSubmit.bind(this));
        }

        // Cancel secret form
        const cancelSecretBtn = document.getElementById('cancel-secret-btn');
        if (cancelSecretBtn) {
            cancelSecretBtn.addEventListener('click', this.hideSecretForm.bind(this));
        }
    }

    // Show login page
    showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }

    // Show main app
    showApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        this.loadDashboard();
    }

    // Show loading overlay
    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    // Hide loading overlay
    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    // Update user info in sidebar
    updateUserInfo() {
        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');

        if (userName) userName.textContent = auth.getUserName();
        if (userRole) userRole.textContent = auth.getUserRole();
    }

    // Handle login form submission
    async handleLogin(event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('login-error');

        // Clear previous error
        errorDiv.classList.add('hidden');

        const result = await auth.login(username, password);

        if (!result.success) {
            errorDiv.textContent = result.error;
            errorDiv.classList.remove('hidden');
        }
    }

    // Handle logout
    handleLogout() {
        auth.logout();
    }

    // Handle navigation
    handleNavigation(event) {
        event.preventDefault();
        const page = event.target.closest('a').dataset.page;
        this.navigateTo(page);
    }

    // Navigate to page
    navigateTo(page) {
        // Update active navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // Hide all pages
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Show selected page
        document.getElementById(`${page}-page`).classList.remove('hidden');

        this.currentPage = page;

        // Load page data
        switch (page) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'secrets':
                this.loadSecrets();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'roles':
                this.loadRoles();
                break;
            case 'policies':
                this.loadPolicies();
                break;
            case 'audit':
                this.loadAudit();
                break;
        }
    }

    // Load dashboard data
    async loadDashboard() {
        try {
            const [secrets, users, roles, policies, audit] = await Promise.all([
                api.getSecrets(),
                api.getUsers(),
                api.getRoles(),
                api.getPolicies(),
                api.getAuditLogs(5)
            ]);

            // Update stats
            document.getElementById('secrets-count').textContent = secrets.length;
            document.getElementById('users-count').textContent = users.length;
            document.getElementById('roles-count').textContent = roles.length;
            document.getElementById('policies-count').textContent = policies.length;

            // Update recent activity
            this.renderActivityList(audit);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    // Load secrets
    async loadSecrets() {
        try {
            this.showSecretsLoading();
            const secrets = await api.getSecrets();
            this.renderSecretsList(secrets);
        } catch (error) {
            console.error('Failed to load secrets:', error);
            this.showSecretsError('Failed to load secrets');
        }
    }

    // Load users
    async loadUsers() {
        // Placeholder - implement when backend supports
        console.log('Users page loaded');
    }

    // Load roles
    async loadRoles() {
        // Placeholder - implement when backend supports
        console.log('Roles page loaded');
    }

    // Load policies
    async loadPolicies() {
        // Placeholder - implement when backend supports
        console.log('Policies page loaded');
    }

    // Load audit logs
    async loadAudit() {
        // Placeholder - implement when backend supports
        console.log('Audit page loaded');
    }

    // Render activity list
    renderActivityList(activities) {
        const container = document.getElementById('activity-list');

        if (activities.length === 0) {
            container.innerHTML = '<p class="no-data">No recent activity</p>';
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">📋</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.action} - ${activity.resource_type}</div>
                    <div class="activity-time">${new Date(activity.timestamp).toLocaleString()}</div>
                </div>
            </div>
        `).join('');
    }

    // Show secrets loading
    showSecretsLoading() {
        document.getElementById('secrets-list').innerHTML = '<div class="loading">Loading secrets...</div>';
    }

    // Show secrets error
    showSecretsError(message) {
        document.getElementById('secrets-error').textContent = message;
        document.getElementById('secrets-error').classList.remove('hidden');
    }

    // Render secrets list
    renderSecretsList(secrets) {
        const container = document.getElementById('secrets-list');

        if (secrets.length === 0) {
            container.innerHTML = '<div class="no-data">No secrets found. Create your first secret to get started.</div>';
            return;
        }

        container.innerHTML = secrets.map(secret => `
            <div class="data-item" data-id="${secret.id}">
                <div class="data-content">
                    <div class="data-title">${secret.name}</div>
                    ${secret.description ? `<div class="data-subtitle">${secret.description}</div>` : ''}
                    <div class="data-value">
                        ${this.visibleSecrets.has(secret.id) ? secret.value : '••••••••'}
                        <button class="action-btn" onclick="ui.toggleSecretVisibility(${secret.id})">
                            ${this.visibleSecrets.has(secret.id) ? '🙈' : '👁️'}
                        </button>
                    </div>
                </div>
                <div class="data-actions">
                    <button class="action-btn edit" onclick="ui.editSecret(${secret.id})" title="Edit">
                        ✏️
                    </button>
                    <button class="action-btn delete" onclick="ui.deleteSecret(${secret.id})" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Toggle secret visibility
    toggleSecretVisibility(id) {
        if (this.visibleSecrets.has(id)) {
            this.visibleSecrets.delete(id);
        } else {
            this.visibleSecrets.add(id);
        }
        this.loadSecrets(); // Re-render list
    }

    // Show secret form
    showSecretForm(secret = null) {
        const form = document.getElementById('secret-form');
        const title = document.getElementById('secret-form-title');
        const formElement = document.getElementById('secret-form-element');

        if (secret) {
            title.textContent = 'Edit Secret';
            document.getElementById('secret-name').value = secret.name;
            document.getElementById('secret-value').value = secret.value;
            document.getElementById('secret-description').value = secret.description || '';
            formElement.dataset.editId = secret.id;
        } else {
            title.textContent = 'Add New Secret';
            formElement.reset();
            delete formElement.dataset.editId;
        }

        form.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
    }

    // Hide secret form
    hideSecretForm() {
        document.getElementById('secret-form').classList.add('hidden');
    }

    // Handle secret form submission
    async handleSecretSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const secret = {
            name: formData.get('name'),
            value: formData.get('value'),
            description: formData.get('description')
        };

        const editId = event.target.dataset.editId;

        try {
            if (editId) {
                await api.updateSecret(editId, secret);
            } else {
                await api.createSecret(secret);
            }

            this.hideSecretForm();
            this.loadSecrets();
        } catch (error) {
            this.showSecretsError(error.message);
        }
    }

    // Edit secret
    editSecret(id) {
        // Find secret in current list (this is a simple implementation)
        // In a real app, you'd fetch the secret details
        const secretElement = document.querySelector(`[data-id="${id}"]`);
        if (secretElement) {
            const name = secretElement.querySelector('.data-title').textContent;
            const description = secretElement.querySelector('.data-subtitle')?.textContent || '';
            // Note: We can't get the actual secret value from the UI since it's masked
            // In a real implementation, you'd fetch the secret details from the API
            this.showSecretForm({ id, name, value: '', description });
        }
    }

    // Delete secret
    async deleteSecret(id) {
        if (!confirm('Are you sure you want to delete this secret?')) return;

        try {
            await api.deleteSecret(id);
            this.loadSecrets();
        } catch (error) {
            this.showSecretsError(error.message);
        }
    }

    // Show error message
    showError(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.right = '20px';
        errorDiv.style.zIndex = '1000';

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Create global UI instance
const ui = new UI();

// Export for use in other modules
window.UI = UI;
window.ui = ui;