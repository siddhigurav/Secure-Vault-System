const express = require('express');
const { query } = require('../db/connection');
const { simulateAccess } = require('../services/policyEngine');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { auditLog } = require('../services/auditService');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const policySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  effect: Joi.string().valid('allow', 'deny').required(),
  roles: Joi.array().items(Joi.string()).min(1).required(),
  actions: Joi.array().items(Joi.string()).min(1).required(),
  resources: Joi.array().items(Joi.string()).min(1).required(),
  conditions: Joi.object().optional(),
  priority: Joi.number().integer().optional()
});

const simulateSchema = Joi.object({
  userId: Joi.number().integer().required(),
  action: Joi.string().required(),
  resourcePath: Joi.string().required()
});

/**
 * GET /api/policies
 * List all policies
 */
router.get('/', authenticate, requireRole('security-admin', 'auditor'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, effect, roles, actions, resources, conditions, priority, is_active, created_at
       FROM policies
       ORDER BY priority DESC, name ASC`
    );
    
    res.json({
      policies: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('List policies error:', error);
    res.status(500).json({
      error: 'Failed to list policies',
      message: error.message
    });
  }
});

/**
 * GET /api/policies/:id
 * Get policy by ID
 */
router.get('/:id', authenticate, requireRole('security-admin', 'auditor'), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM policies WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Policy not found'
      });
    }
    
    res.json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Get policy error:', error);
    res.status(500).json({
      error: 'Failed to get policy',
      message: error.message
    });
  }
});

/**
 * POST /api/policies
 * Create a new policy
 */
router.post('/', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    // Validate input
    const { error, value } = policySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { name, description, effect, roles, actions, resources, conditions, priority } = value;
    
    // Check if policy name already exists
    const existing = await query(
      'SELECT id FROM policies WHERE name = $1',
      [name]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'Policy name already exists'
      });
    }
    
    // Create policy
    const result = await query(
      `INSERT INTO policies (name, description, effect, roles, actions, resources, conditions, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        description,
        effect,
        JSON.stringify(roles),
        JSON.stringify(actions),
        JSON.stringify(resources),
        JSON.stringify(conditions || {}),
        priority || 0,
        req.user.userId
      ]
    );
    
    const policy = result.rows[0];
    
    // Audit log
    await auditLog({
      userId: req.user.userId,
      username: req.user.username,
      action: 'policy_create',
      resourceType: 'policy',
      resourcePath: name,
      result: 'success',
      metadata: { effect, roles, actions, resources }
    });
    
    res.status(201).json({
      message: 'Policy created successfully',
      policy
    });
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(400).json({
      error: 'Failed to create policy',
      message: error.message
    });
  }
});

/**
 * PUT /api/policies/:id
 * Update a policy
 */
router.put('/:id', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    // Validate input
    const { error, value } = policySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { name, description, effect, roles, actions, resources, conditions, priority } = value;
    
    const result = await query(
      `UPDATE policies
       SET name = $1, description = $2, effect = $3, roles = $4, actions = $5, 
           resources = $6, conditions = $7, priority = $8, updated_by = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name,
        description,
        effect,
        JSON.stringify(roles),
        JSON.stringify(actions),
        JSON.stringify(resources),
        JSON.stringify(conditions || {}),
        priority || 0,
        req.user.userId,
        req.params.id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Policy not found'
      });
    }
    
    const policy = result.rows[0];
    
    // Audit log
    await auditLog({
      userId: req.user.userId,
      username: req.user.username,
      action: 'policy_update',
      resourceType: 'policy',
      resourcePath: name,
      result: 'success',
      metadata: { policyId: req.params.id }
    });
    
    res.json({
      message: 'Policy updated successfully',
      policy
    });
  } catch (error) {
    console.error('Update policy error:', error);
    res.status(400).json({
      error: 'Failed to update policy',
      message: error.message
    });
  }
});

/**
 * DELETE /api/policies/:id
 * Delete a policy (soft delete)
 */
router.delete('/:id', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    const result = await query(
      'UPDATE policies SET is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2 RETURNING name',
      [req.user.userId, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Policy not found'
      });
    }
    
    // Audit log
    await auditLog({
      userId: req.user.userId,
      username: req.user.username,
      action: 'policy_delete',
      resourceType: 'policy',
      resourcePath: result.rows[0].name,
      result: 'success',
      metadata: { policyId: req.params.id }
    });
    
    res.json({
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete policy error:', error);
    res.status(400).json({
      error: 'Failed to delete policy',
      message: error.message
    });
  }
});

/**
 * POST /api/policies/simulate
 * Simulate policy evaluation
 */
router.post('/simulate', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    // Validate input
    const { error, value } = simulateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }
    
    const { userId, action, resourcePath } = value;
    
    const result = await simulateAccess(userId, action, resourcePath);
    
    res.json({
      simulation: {
        userId,
        action,
        resourcePath,
        ...result
      }
    });
  } catch (error) {
    console.error('Simulate policy error:', error);
    res.status(400).json({
      error: 'Failed to simulate policy',
      message: error.message
    });
  }
});

module.exports = router;
