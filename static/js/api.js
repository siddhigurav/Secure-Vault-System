// API Module - Handles HTTP requests and authentication
class API {
    constructor(baseURL = '') {
        // Use backend server URL instead of current origin
        this.baseURL = baseURL || 'http://localhost:8000';
        this.token = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }

    // Set authentication tokens
    setTokens(accessToken, refreshToken) {
        this.token = accessToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    }

    // Clear authentication tokens
    clearTokens() {
        this.token = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }

    // Get authorization headers
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    // Make HTTP request
    async request(url, options = {}) {
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        // Handle form data
        if (options.formData) {
            config.headers = {
                ...config.headers,
                'Content-Type': 'application/x-www-form-urlencoded'
            };
            delete config.headers['Content-Type']; // Let browser set it for FormData
            config.body = options.formData;
        }

        try {
            const response = await fetch(`${this.baseURL}${url}`, config);

            // Handle 401 - try to refresh token
            if (response.status === 401 && this.refreshToken && !options._retry) {
                try {
                    const refreshResponse = await this.refreshAccessToken();
                    if (refreshResponse) {
                        // Retry the original request with new token
                        options._retry = true;
                        return this.request(url, options);
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    this.clearTokens();
                    window.location.reload(); // Redirect to login
                }
            }

            // Handle other error responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Refresh access token
    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.baseURL}/api/v1/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.setTokens(data.access_token, data.refresh_token);
                return true;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
        }
        return false;
    }

    // Authentication methods
    async login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const data = await this.request('/api/v1/login', {
            method: 'POST',
            formData: formData
        });

        this.setTokens(data.access_token, data.refresh_token);
        return data;
    }

    async logout() {
        this.clearTokens();
    }

    // Secrets methods
    async getSecrets() {
        return this.request('/api/v1/secrets');
    }

    async createSecret(secret) {
        return this.request('/api/v1/secrets', {
            method: 'POST',
            body: JSON.stringify(secret)
        });
    }

    async updateSecret(id, secret) {
        return this.request(`/api/v1/secrets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(secret)
        });
    }

    async deleteSecret(id) {
        return this.request(`/api/v1/secrets/${id}`, {
            method: 'DELETE'
        });
    }

    // Users methods
    async getUsers() {
        return this.request('/api/v1/users');
    }

    // Roles methods
    async getRoles() {
        return this.request('/api/v1/roles');
    }

    // Policies methods
    async getPolicies() {
        return this.request('/api/v1/policies');
    }

    // Audit methods
    async getAuditLogs(limit = 10) {
        return this.request(`/api/v1/audit?limit=${limit}`);
    }
}

// Create global API instance
const api = new API();

// Export for use in other modules
window.API = API;
window.api = api;