-- =====================================================
-- Secure Vault System - Database Schema
-- =====================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS secret_versions CASCADE;
DROP TABLE IF EXISTS secrets CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- USER ROLES TABLE (Many-to-Many relationship)
-- =====================================================
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- =====================================================
-- SECRETS TABLE
-- =====================================================
CREATE TABLE secrets (
    id SERIAL PRIMARY KEY,
    path VARCHAR(500) UNIQUE NOT NULL,
    encrypted_value TEXT NOT NULL,
    encrypted_dek TEXT NOT NULL,
    description TEXT,
    tags JSONB DEFAULT '[]',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_secrets_path ON secrets(path);
CREATE INDEX idx_secrets_created_by ON secrets(created_by);
CREATE INDEX idx_secrets_is_active ON secrets(is_active);
CREATE INDEX idx_secrets_tags ON secrets USING GIN(tags);

-- =====================================================
-- SECRET VERSIONS TABLE (for rotation history)
-- =====================================================
CREATE TABLE secret_versions (
    id SERIAL PRIMARY KEY,
    secret_id INTEGER NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    encrypted_value TEXT NOT NULL,
    encrypted_dek TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(secret_id, version)
);

CREATE INDEX idx_secret_versions_secret_id ON secret_versions(secret_id);

-- =====================================================
-- POLICIES TABLE
-- =====================================================
CREATE TABLE policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    roles JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    resources JSONB NOT NULL DEFAULT '[]',
    conditions JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policies_name ON policies(name);
CREATE INDEX idx_policies_roles ON policies USING GIN(roles);
CREATE INDEX idx_policies_is_active ON policies(is_active);

-- =====================================================
-- AUDIT LOGS TABLE (Append-only, immutable)
-- =====================================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_path VARCHAR(500),
    result VARCHAR(50) NOT NULL,
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64)
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_resource_path ON audit_logs(resource_path);

-- Prevent updates and deletes on audit_logs (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- =====================================================
-- SEED DATA (Initial Admin User)
-- =====================================================
-- Password: Admin@123 (hashed with bcrypt)
-- NOTE: Change this password immediately after first login!
INSERT INTO users (username, email, password_hash) VALUES 
('admin', 'admin@vault.local', '$2b$10$rKZLQJxW5O1Cq7Ux8xNxXeYvF8vZGqJ3mH9nP2wQ4rT6sU8vW0xYz');

INSERT INTO user_roles (user_id, role, granted_by) VALUES 
(1, 'security-admin', 1),
(1, 'platform-engineer', 1),
(1, 'auditor', 1);

-- =====================================================
-- SAMPLE POLICIES (for demonstration)
-- =====================================================
INSERT INTO policies (name, description, effect, roles, actions, resources, created_by) VALUES 
(
    'admin-full-access',
    'Security admins have full access to all resources',
    'allow',
    '["security-admin"]',
    '["read", "write", "delete", "rotate", "read_reveal"]',
    '["*"]',
    1
),
(
    'developer-non-prod-read',
    'Developers can read non-production secrets',
    'allow',
    '["developer"]',
    '["read", "read_masked"]',
    '["dev/*", "staging/*"]',
    1
),
(
    'auditor-logs-only',
    'Auditors can only view audit logs',
    'allow',
    '["auditor"]',
    '["read"]',
    '["audit/*"]',
    1
),
(
    'deny-prod-delete',
    'Prevent deletion of production secrets',
    'deny',
    '["*"]',
    '["delete"]',
    '["prod/*"]',
    1
);

-- =====================================================
-- VIEWS (for easier querying)
-- =====================================================
CREATE VIEW active_secrets AS
SELECT 
    s.id,
    s.path,
    s.description,
    s.tags,
    s.version,
    u.username as created_by_username,
    s.created_at,
    s.updated_at
FROM secrets s
JOIN users u ON s.created_by = u.id
WHERE s.is_active = true;

CREATE VIEW user_permissions AS
SELECT 
    u.id as user_id,
    u.username,
    ur.role,
    p.name as policy_name,
    p.effect,
    p.actions,
    p.resources
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN policies p ON p.roles @> to_jsonb(ur.role)
WHERE u.is_active = true AND p.is_active = true;
