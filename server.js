require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const { closeConnections } = require('./db/connection');
const {
  configureHelmet,
  configureCORS,
  configureRateLimit,
  configureAuthRateLimit,
  sanitizeInput,
  addRequestId
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const secretRoutes = require('./routes/secrets');
const policyRoutes = require('./routes/policies');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// SECURITY MIDDLEWARE
// =====================================================
app.use(configureHelmet());
app.use(configureCORS());
app.use(addRequestId);

// =====================================================
// GENERAL MIDDLEWARE
// =====================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// =====================================================
// STATIC FILES
// =====================================================
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// HEALTH CHECK
// =====================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// =====================================================
// API ROUTES
// =====================================================
app.use('/api/auth', configureAuthRateLimit(), authRoutes);
app.use('/api/secrets', configureRateLimit(), secretRoutes);
app.use('/api/policies', configureRateLimit(), policyRoutes);
app.use('/api/audit', configureRateLimit(), auditRoutes);

// =====================================================
// ROOT ROUTE
// =====================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message,
    requestId: req.id
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================
const server = app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║          🔒 SECURE VAULT SYSTEM                        ║');
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  • POST   /api/auth/register      - Register new user');
  console.log('  • POST   /api/auth/login         - Login and get token');
  console.log('  • GET    /api/auth/me            - Get current user');
  console.log('  • POST   /api/secrets            - Create secret');
  console.log('  • GET    /api/secrets            - List secrets');
  console.log('  • GET    /api/secrets/:path      - Get secret (masked)');
  console.log('  • GET    /api/secrets/:path/reveal - Reveal secret');
  console.log('  • POST   /api/policies           - Create policy');
  console.log('  • GET    /api/policies           - List policies');
  console.log('  • POST   /api/policies/simulate  - Simulate access');
  console.log('  • GET    /api/audit              - Query audit logs');
  console.log('  • GET    /api/audit/export       - Export audit logs');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('\n\nReceived shutdown signal, closing server gracefully...');
  
  server.close(async () => {
    console.log('✓ HTTP server closed');
    
    try {
      await closeConnections();
      console.log('✓ Database connections closed');
      console.log('\nShutdown complete. Goodbye! 👋\n');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

module.exports = app;
