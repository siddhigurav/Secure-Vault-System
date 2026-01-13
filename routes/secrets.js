const express = require('express');
const { 
  createSecret, 
  getSecretMasked, 
  getSecretRevealed, 
  listSecrets,
  updateSecret,
  rotateSecret,
  deleteSecret
} = require('../services/secretService');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createSecretSchema = Joi.object({
  path: Joi.string().pattern(/^[a-zA-Z0-9/_-]+$/).required(),
  value: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

const updateSecretSchema = Joi.object({
  description: Joi.string().allow('').optional(),
  tags: Joi.array().items(Joi.string()).optional()
}).min(1);

const rotateSecretSchema = Joi.object({
  value: Joi.string().required()
});

/**
 * POST /api/secrets
 * Create a new secret
 */
router.post('/', 
  authenticate, 
  authorize('write', req => req.body.path),
  async (req, res) => {
    try {
      // Validate input
      const { error, value } = createSecretSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.details[0].message
        });
      }
      
      const { path, value: secretValue, description, tags } = value;
      
      // Create secret
      const secret = await createSecret({
        path,
        value: secretValue,
        description,
        tags,
        createdBy: req.user.userId
      });
      
      res.status(201).json({
        message: 'Secret created successfully',
        secret
      });
    } catch (error) {
      console.error('Create secret error:', error);
      res.status(400).json({
        error: 'Failed to create secret',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/secrets
 * List secrets (metadata only)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      pathPrefix: req.query.prefix,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };
    
    const secrets = await listSecrets(filters);
    
    res.json({
      secrets,
      count: secrets.length,
      filters
    });
  } catch (error) {
    console.error('List secrets error:', error);
    res.status(500).json({
      error: 'Failed to list secrets',
      message: error.message
    });
  }
});

/**
 * GET /api/secrets/:path
 * Get secret with masked value
 */
router.get('/:path(*)', 
  authenticate,
  authorize('read', req => req.params.path),
  async (req, res) => {
    try {
      const path = req.params.path;
      const secret = await getSecretMasked(path, req.user.userId);
      
      res.json({ secret });
    } catch (error) {
      console.error('Get secret error:', error);
      res.status(404).json({
        error: 'Secret not found',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/secrets/:path/reveal
 * Get secret with plaintext value (requires special permission)
 */
router.get('/:path(*)/reveal', 
  authenticate,
  authorize('read_reveal', req => req.params.path.replace('/reveal', '')),
  async (req, res) => {
    try {
      const path = req.params.path.replace('/reveal', '');
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      const secret = await getSecretRevealed(
        path, 
        req.user.userId, 
        req.user.username,
        ipAddress
      );
      
      res.json({ 
        secret,
        warning: 'This secret will be cleared from memory after transmission'
      });
    } catch (error) {
      console.error('Reveal secret error:', error);
      res.status(404).json({
        error: 'Secret not found',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/secrets/:path
 * Update secret metadata
 */
router.put('/:path(*)', 
  authenticate,
  authorize('write', req => req.params.path),
  async (req, res) => {
    try {
      const path = req.params.path;
      
      // Validate input
      const { error, value } = updateSecretSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.details[0].message
        });
      }
      
      const secret = await updateSecret(path, value, req.user.userId);
      
      res.json({
        message: 'Secret updated successfully',
        secret
      });
    } catch (error) {
      console.error('Update secret error:', error);
      res.status(400).json({
        error: 'Failed to update secret',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/secrets/:path/rotate
 * Rotate secret (create new version)
 */
router.post('/:path(*)/rotate', 
  authenticate,
  authorize('rotate', req => req.params.path.replace('/rotate', '')),
  async (req, res) => {
    try {
      const path = req.params.path.replace('/rotate', '');
      
      // Validate input
      const { error, value } = rotateSecretSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.details[0].message
        });
      }
      
      const secret = await rotateSecret(path, value.value, req.user.userId);
      
      res.json({
        message: 'Secret rotated successfully',
        secret
      });
    } catch (error) {
      console.error('Rotate secret error:', error);
      res.status(400).json({
        error: 'Failed to rotate secret',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/secrets/:path
 * Delete secret (soft delete)
 */
router.delete('/:path(*)', 
  authenticate,
  authorize('delete', req => req.params.path),
  async (req, res) => {
    try {
      const path = req.params.path;
      await deleteSecret(path, req.user.userId);
      
      res.json({
        message: 'Secret deleted successfully',
        path
      });
    } catch (error) {
      console.error('Delete secret error:', error);
      res.status(400).json({
        error: 'Failed to delete secret',
        message: error.message
      });
    }
  }
);

module.exports = router;
