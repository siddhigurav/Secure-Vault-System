const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');
const { auditLog } = require('./auditService');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in environment variables');
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for authenticated user
 * @param {Object} user - User object with id, username, roles
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    roles: user.roles || [],
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Register a new user
 * @param {string} username - Username
 * @param {string} email - Email address
 * @param {string} password - Plain text password
 * @param {Array<string>} roles - User roles (optional)
 * @returns {Promise<Object>} Created user (without password)
 */
async function registerUser(username, email, password, roles = ['developer']) {
  // Validate input
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required');
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  
  if (existingUser.rows.length > 0) {
    throw new Error('Username or email already exists');
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create user
  const result = await query(
    `INSERT INTO users (username, email, password_hash) 
     VALUES ($1, $2, $3) 
     RETURNING id, username, email, created_at`,
    [username, email, passwordHash]
  );
  
  const user = result.rows[0];
  
  // Assign roles
  for (const role of roles) {
    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [user.id, role]
    );
  }
  
  // Audit log
  await auditLog({
    userId: user.id,
    username: user.username,
    action: 'user_register',
    resourceType: 'user',
    resourcePath: username,
    result: 'success',
    metadata: { roles }
  });
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    roles,
    createdAt: user.created_at
  };
}

/**
 * Login user and generate JWT token
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @param {string} ipAddress - Client IP address
 * @returns {Promise<Object>} { token, user }
 */
async function login(username, password, ipAddress) {
  // Get user with roles
  const userResult = await query(
    `SELECT u.id, u.username, u.email, u.password_hash, u.is_active, 
            u.failed_login_attempts, u.locked_until,
            COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '[]') as roles
     FROM users u
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     WHERE u.username = $1
     GROUP BY u.id`,
    [username]
  );
  
  if (userResult.rows.length === 0) {
    await auditLog({
      username,
      action: 'login_failed',
      resourceType: 'auth',
      result: 'denied',
      reason: 'User not found',
      ipAddress
    });
    throw new Error('Invalid credentials');
  }
  
  const user = userResult.rows[0];
  
  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await auditLog({
      userId: user.id,
      username: user.username,
      action: 'login_failed',
      resourceType: 'auth',
      result: 'denied',
      reason: 'Account locked',
      ipAddress
    });
    throw new Error('Account is locked. Please try again later.');
  }
  
  // Check if account is active
  if (!user.is_active) {
    await auditLog({
      userId: user.id,
      username: user.username,
      action: 'login_failed',
      resourceType: 'auth',
      result: 'denied',
      reason: 'Account inactive',
      ipAddress
    });
    throw new Error('Account is inactive');
  }
  
  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash);
  
  if (!isValidPassword) {
    // Increment failed attempts
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    const lockUntil = failedAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
      : null;
    
    await query(
      'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
      [failedAttempts, lockUntil, user.id]
    );
    
    await auditLog({
      userId: user.id,
      username: user.username,
      action: 'login_failed',
      resourceType: 'auth',
      result: 'denied',
      reason: 'Invalid password',
      ipAddress,
      metadata: { failedAttempts }
    });
    
    throw new Error('Invalid credentials');
  }
  
  // Reset failed attempts on successful login
  await query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
    [user.id]
  );
  
  // Generate token
  const token = generateToken({
    id: user.id,
    username: user.username,
    roles: user.roles
  });
  
  // Audit log
  await auditLog({
    userId: user.id,
    username: user.username,
    action: 'login_success',
    resourceType: 'auth',
    result: 'success',
    ipAddress
  });
  
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles
    }
  };
}

/**
 * Get user by ID with roles
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User object
 */
async function getUserById(userId) {
  const result = await query(
    `SELECT u.id, u.username, u.email, u.is_active, u.created_at,
            COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '[]') as roles
     FROM users u
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0];
}

/**
 * Assign role to user
 * @param {number} userId - User ID
 * @param {string} role - Role name
 * @param {number} grantedBy - ID of user granting the role
 * @returns {Promise<void>}
 */
async function assignRole(userId, role, grantedBy) {
  await query(
    'INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $3) ON CONFLICT (user_id, role) DO NOTHING',
    [userId, role, grantedBy]
  );
  
  const user = await getUserById(userId);
  
  await auditLog({
    userId: grantedBy,
    action: 'role_assign',
    resourceType: 'user',
    resourcePath: user.username,
    result: 'success',
    metadata: { role, targetUserId: userId }
  });
}

/**
 * Revoke role from user
 * @param {number} userId - User ID
 * @param {string} role - Role name
 * @param {number} revokedBy - ID of user revoking the role
 * @returns {Promise<void>}
 */
async function revokeRole(userId, role, revokedBy) {
  await query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role = $2',
    [userId, role]
  );
  
  const user = await getUserById(userId);
  
  await auditLog({
    userId: revokedBy,
    action: 'role_revoke',
    resourceType: 'user',
    resourcePath: user.username,
    result: 'success',
    metadata: { role, targetUserId: userId }
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  registerUser,
  login,
  getUserById,
  assignRole,
  revokeRole
};
