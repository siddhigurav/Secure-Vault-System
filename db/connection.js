const { Pool } = require('pg');
require('dotenv').config();

/**
 * PostgreSQL connection pool for main database
 */
const mainPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'secure_vault',
  user: process.env.DB_USER || 'vault_admin',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * PostgreSQL connection pool for audit database (separate for immutability)
 */
const auditPool = new Pool({
  host: process.env.AUDIT_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.AUDIT_DB_PORT || process.env.DB_PORT || 5432,
  database: process.env.AUDIT_DB_NAME || 'vault_audit',
  user: process.env.AUDIT_DB_USER || 'audit_admin',
  password: process.env.AUDIT_DB_PASSWORD || process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connections on startup
mainPool.on('connect', () => {
  console.log('✓ Connected to main database');
});

mainPool.on('error', (err) => {
  console.error('Unexpected error on main database client', err);
  process.exit(-1);
});

auditPool.on('connect', () => {
  console.log('✓ Connected to audit database');
});

auditPool.on('error', (err) => {
  console.error('Unexpected error on audit database client', err);
  process.exit(-1);
});

/**
 * Execute a query on the main database
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await mainPool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error: error.message });
    throw error;
  }
}

/**
 * Execute a query on the audit database
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function auditQuery(text, params) {
  const start = Date.now();
  try {
    const res = await auditPool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed audit query', { duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Audit database query error:', error.message);
    throw error;
  }
}

/**
 * Get a client from the main pool for transactions
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  const client = await mainPool.connect();
  const query = client.query;
  const release = client.release;

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
}

/**
 * Graceful shutdown
 */
async function closeConnections() {
  await mainPool.end();
  await auditPool.end();
  console.log('Database connections closed');
}

module.exports = {
  query,
  auditQuery,
  getClient,
  closeConnections,
  mainPool,
  auditPool,
};
