# 🔒 Secure Vault System

Enterprise-grade secret management system with encryption, role-based access control, policy engine, and comprehensive audit logging.

## 🎯 Features

- **🔐 AES-256-GCM Encryption**: Secrets encrypted at rest with unique DEKs
- **👥 Role-Based Access Control**: Fine-grained permissions via policies
- **📋 Policy Engine**: Conditional access with IP ranges, time windows
- **🔍 Audit Logging**: Immutable, cryptographically-chained logs
- **🎨 Modern UI**: Dark-themed, responsive web interface
- **🔄 Secret Rotation**: Versioned secrets with rotation support
- **⚡ Rate Limiting**: Protection against brute force attacks
- **🛡️ Security Headers**: Helmet, CORS, CSP, HSTS

## 📋 Prerequisites

- **Node.js** 16+ and npm
- **PostgreSQL** 12+
- **Git**

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd Secure-Vault-System
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_vault
DB_USER=vault_admin
DB_PASSWORD=your_secure_password

# Encryption (CRITICAL: Generate secure keys!)
MASTER_ENCRYPTION_KEY=<64-character-hex-string>
JWT_SECRET=<your-jwt-secret-32-chars-minimum>
```

**Generate secure keys:**

```bash
# Master encryption key (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Setup Database

Create PostgreSQL databases:

```bash
psql -U postgres
CREATE DATABASE secure_vault;
CREATE DATABASE vault_audit;
\q
```

Run schema:

```bash
psql -U postgres -d secure_vault -f db/schema.sql
psql -U postgres -d vault_audit -f db/schema.sql
```

### 5. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

## 🔑 Default Credentials

**Username:** `admin`  
**Password:** `Admin@123`

⚠️ **CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN!**

## 📚 API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "roles": ["developer"]
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "username": "admin", "roles": [...] }
}
```

### Secrets

#### Create Secret
```http
POST /api/secrets
Authorization: Bearer <token>
Content-Type: application/json

{
  "path": "prod/database/password",
  "value": "super-secret-password",
  "description": "Production database password",
  "tags": ["database", "production"]
}
```

#### List Secrets
```http
GET /api/secrets?prefix=prod&limit=50
Authorization: Bearer <token>
```

#### Get Secret (Masked)
```http
GET /api/secrets/prod/database/password
Authorization: Bearer <token>

Response:
{
  "secret": {
    "path": "prod/database/password",
    "value": "super-se••••••••••••••••",
    "description": "Production database password",
    ...
  }
}
```

#### Reveal Secret (Plaintext)
```http
GET /api/secrets/prod/database/password/reveal
Authorization: Bearer <token>

Response:
{
  "secret": {
    "path": "prod/database/password",
    "value": "super-secret-password",
    ...
  }
}
```

#### Rotate Secret
```http
POST /api/secrets/prod/database/password/rotate
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "new-super-secret-password"
}
```

### Policies

#### Create Policy
```http
POST /api/policies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "dev-team-access",
  "description": "Developers can read dev secrets",
  "effect": "allow",
  "roles": ["developer"],
  "actions": ["read", "read_masked"],
  "resources": ["dev/*", "staging/*"],
  "conditions": {
    "ip_range": "10.0.0.0/8"
  }
}
```

#### Simulate Access
```http
POST /api/policies/simulate
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": 2,
  "action": "read_reveal",
  "resourcePath": "prod/stripe-api-key"
}

Response:
{
  "simulation": {
    "allowed": false,
    "reason": "No policy grants 'read_reveal' on 'prod/stripe-api-key'",
    "policies": [...]
  }
}
```

### Audit Logs

#### Query Logs
```http
GET /api/audit?action=secret_read_reveal&startDate=2024-01-01&limit=100
Authorization: Bearer <token>
```

#### Export CSV
```http
GET /api/audit/export?startDate=2024-01-01
Authorization: Bearer <token>
```

## 🏗️ Architecture

```
┌─────────────┐
│   Browser   │
│   (React)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      Express API Gateway        │
│  (Auth, Rate Limit, Security)   │
└──────┬──────────────────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ Auth Service │   │Policy Engine │
└──────────────┘   └──────────────┘
       │                  │
       ▼                  ▼
┌──────────────────────────────────┐
│       Secret Service             │
│    (Encryption/Decryption)       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────┐   ┌──────────────┐
│  PostgreSQL  │   │  Audit DB    │
│  (Secrets)   │   │ (Immutable)  │
└──────────────┘   └──────────────┘
```

## 🔒 Security Best Practices

### Production Deployment

1. **Use HSM/KMS for Master Key**
   - AWS KMS, Azure Key Vault, or Google Cloud KMS
   - Never store master key in environment variables in production

2. **Enable HTTPS**
   - Use TLS 1.3
   - Configure proper certificates

3. **Database Security**
   - Use separate databases for main and audit
   - Enable PostgreSQL SSL connections
   - Restrict network access

4. **Monitoring**
   - Set up alerts for failed login attempts
   - Monitor audit log anomalies
   - Track secret access patterns

5. **Backup Strategy**
   - Regular encrypted backups
   - Test restore procedures
   - Store backups off-site

### Key Rotation

Rotate master encryption key every 90 days:

```bash
# Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update .env with NEW_KEY
# Restart application
# Old secrets remain accessible (DEKs re-encrypted automatically)
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific service
npm run test:encryption
npm run test:policies
npm run test:audit
```

## 📊 Monitoring

### Health Check

```http
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2024-01-13T14:30:00.000Z",
  "uptime": 3600
}
```

### Audit Log Verification

```http
GET /api/audit/verify
Authorization: Bearer <token>

Response:
{
  "verification": {
    "valid": true,
    "message": "Verified 1000 audit log entries"
  }
}
```

## 🐛 Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U vault_admin -d secure_vault -c "SELECT 1;"
```

### Encryption Errors

```bash
# Verify master key length (must be 64 hex characters)
echo $MASTER_ENCRYPTION_KEY | wc -c
# Should output: 65 (64 chars + newline)
```

### JWT Token Issues

```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Check token expiry in .env
JWT_EXPIRY=8h
```

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Contact: security@example.com

## ⚠️ Disclaimer

This system is designed for internal enterprise use. While it implements industry-standard security practices, it should be:
- Reviewed by security professionals before production use
- Deployed in a secure network environment
- Regularly updated and monitored
- Part of a comprehensive security strategy

**Not a replacement for:**
- Network security
- Application security
- Physical security
- Security awareness training