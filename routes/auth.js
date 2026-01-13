const express = require('express');
const { registerUser, login, getUserById, assignRole, revokeRole } = require('../services/authService');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { auditLog } = require('../services/auditService');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  roles: Joi.array().items(Joi.string()).optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const roleSchema = Joi.object({
  userId: Joi.number().integer().required(),
  role: Joi.string().required()
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { username, email, password, roles } = value;
    
    // Register user
    const user = await registerUser(username, email, password, roles);
    
    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Login and receive JWT token
 */
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { username, password } = value;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Login
    const { token, user } = await login(username, password, ipAddress);
    
    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(404).json({
      error: 'User not found',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/roles/assign
 * Assign role to user (admin only)
 */
router.post('/roles/assign', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    // Validate input
    const { error, value } = roleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { userId, role } = value;
    
    await assignRole(userId, role, req.user.userId);
    
    res.json({
      message: 'Role assigned successfully',
      userId,
      role
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(400).json({
      error: 'Failed to assign role',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/roles/revoke
 * Revoke role from user (admin only)
 */
router.post('/roles/revoke', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    // Validate input
    const { error, value } = roleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { userId, role } = value;
    
    await revokeRole(userId, role, req.user.userId);
    
    res.json({
      message: 'Role revoked successfully',
      userId,
      role
    });
  } catch (error) {
    console.error('Revoke role error:', error);
    res.status(400).json({
      error: 'Failed to revoke role',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token invalidation)
 */
router.post('/logout', authenticate, async (req, res) => {
  // Log logout event
  await auditLog({
    userId: req.user.userId,
    username: req.user.username,
    action: 'logout',
    resourceType: 'auth',
    result: 'success',
    ipAddress: req.ip
  });
  
  res.json({
    message: 'Logout successful. Please delete your token on the client side.'
  });
});

module.exports = router;
