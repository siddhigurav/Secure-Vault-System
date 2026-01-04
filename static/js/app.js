// Main Application Entry Point
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initApp();
});

function initApp() {
    // Check if user is already authenticated
    if (auth.checkAuth()) {
        // User is authenticated, show the main app
        ui.showApp();
    } else {
        // User is not authenticated, show login page
        ui.showLogin();
    }

    // Set up global error handling
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        ui.showError('An unexpected error occurred. Please try again.');
    });

    window.addEventListener('error', function(event) {
        console.error('JavaScript error:', event.error);
        ui.showError('An unexpected error occurred. Please refresh the page.');
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        // For now, just prevent default behavior
        // In a more complex app, you'd handle routing here
        event.preventDefault();
    });

    // Set up keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Escape key to close forms
        if (event.key === 'Escape') {
            ui.hideSecretForm();
        }
    });

    console.log('Secure Vault System initialized');
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// Make utility functions globally available
window.debounce = debounce;
window.formatDate = formatDate;
window.formatRelativeTime = formatRelativeTime;