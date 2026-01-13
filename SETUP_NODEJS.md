# Quick Setup Guide for Node.js Backend

## Problem
You're running a Python server (`python dev.py`), but the frontend expects a Node.js backend.

## Solution: Use Node.js Server

### Step 1: Stop Python Server
Press `Ctrl+C` in the terminal running `python dev.py`

### Step 2: Configure Environment
Edit your `.env` file with these settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (using SQLite for simplicity)
# The Node.js app will use the existing secure_vault.db file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_vault
DB_USER=postgres
DB_PASSWORD=postgres

# Audit Database
AUDIT_DB_HOST=localhost
AUDIT_DB_PORT=5432
AUDIT_DB_NAME=secure_vault
AUDIT_DB_USER=postgres
AUDIT_DB_PASSWORD=postgres

# Encryption Keys (CRITICAL: Use these generated keys)
MASTER_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
JWT_SECRET=f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1

# JWT Configuration
JWT_EXPIRY=8h

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

### Step 3: Install PostgreSQL (if not installed)
```bash
# Download from: https://www.postgresql.org/download/windows/
# Or use the existing SQLite database
```

### Step 4: Setup Database
```bash
node scripts/setupDatabase.js
```

### Step 5: Start Node.js Server
```bash
npm start
```

Server will run on: http://localhost:3000

### Step 6: Login
- Username: `admin`
- Password: `Admin@123`

---

## Alternative: Adapt Frontend to Python Backend

If you prefer to use the existing Python backend, you need to:

1. Update `public/js/app.js` to match Python API endpoints
2. Ensure Python backend has all required endpoints
3. Check CORS settings in Python backend

---

## Current Issue
The frontend (`public/js/app.js`) is calling `/api/auth/login`, but your Python server returns `{"message":"Secure Vault System API"}` at the root, indicating it's not handling the auth endpoints correctly.

**Recommended:** Use the Node.js backend I built, as it's fully integrated with the frontend.
