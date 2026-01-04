// Authentication Module - Handles user authentication and session management
class Auth {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.init();
    }

    // Initialize authentication state
    init() {
        const token = localStorage.getItem('accessToken');
        if (token) {
            try {
                // Decode JWT token to get user info (simple decode, not secure validation)
                const payload = JSON.parse(atob(token.split('.')[1]));
                this.user = payload;
                this.isAuthenticated = true;
            } catch (error) {
                console.error('Invalid token:', error);
                this.logout();
            }
        }
    }

    // Login user
    async login(username, password) {
        try {
            UI.showLoading();

            const data = await api.login(username, password);

            // Decode token to get user info
            const payload = JSON.parse(atob(data.access_token.split('.')[1]));
            this.user = payload;
            this.isAuthenticated = true;

            UI.hideLoading();
            UI.showApp();

            return { success: true };
        } catch (error) {
            UI.hideLoading();
            return { success: false, error: error.message };
        }
    }

    // Logout user
    logout() {
        api.logout();
        this.user = null;
        this.isAuthenticated = false;
        UI.showLogin();
    }

    // Check if user is authenticated
    checkAuth() {
        return this.isAuthenticated;
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // Get user display name
    getUserName() {
        return this.user?.sub || 'User';
    }

    // Get user role
    getUserRole() {
        return this.user?.role || 'User';
    }
}

// Create global auth instance
const auth = new Auth();

// Export for use in other modules
window.Auth = Auth;
window.auth = auth;