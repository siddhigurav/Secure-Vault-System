const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Database Setup Script
 * Creates databases and runs schema
 */

async function setupDatabase() {
  console.log('🔧 Setting up Secure Vault databases...\n');

  // Connect to default postgres database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  });

  try {
    // Create main database
    console.log('Creating main database...');
    await adminPool.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME || 'secure_vault'}`);
    await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME || 'secure_vault'}`);
    console.log('✓ Main database created\n');

    // Create audit database
    console.log('Creating audit database...');
    await adminPool.query(`DROP DATABASE IF EXISTS ${process.env.AUDIT_DB_NAME || 'vault_audit'}`);
    await adminPool.query(`CREATE DATABASE ${process.env.AUDIT_DB_NAME || 'vault_audit'}`);
    console.log('✓ Audit database created\n');

    await adminPool.end();

    // Connect to main database and run schema
    console.log('Running schema on main database...');
    const mainPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'secure_vault',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    });

    const schemaSQL = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
    await mainPool.query(schemaSQL);
    console.log('✓ Main database schema created\n');
    await mainPool.end();

    // Connect to audit database and run schema
    console.log('Running schema on audit database...');
    const auditPool = new Pool({
      host: process.env.AUDIT_DB_HOST || process.env.DB_HOST || 'localhost',
      port: process.env.AUDIT_DB_PORT || process.env.DB_PORT || 5432,
      database: process.env.AUDIT_DB_NAME || 'vault_audit',
      user: process.env.AUDIT_DB_USER || process.env.DB_USER || 'postgres',
      password: process.env.AUDIT_DB_PASSWORD || process.env.DB_PASSWORD
    });

    await auditPool.query(schemaSQL);
    console.log('✓ Audit database schema created\n');
    await auditPool.end();

    console.log('✅ Database setup complete!\n');
    console.log('Default admin credentials:');
    console.log('  Username: admin');
    console.log('  Password: Admin@123');
    console.log('\n⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!\n');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
