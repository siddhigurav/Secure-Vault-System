const { query, getClient } = require('../db/connection');
const { encryptSecret, decryptSecret, maskSecret } = require('./encryptionService');
const { auditLog } = require('./auditService');

/**
 * Secret Service
 * Manages secret storage, retrieval, and lifecycle
 */

/**
 * Create a new secret
 * @param {Object} secretData - Secret data
 * @param {string} secretData.path - Secret path (unique identifier)
 * @param {string} secretData.value - Secret value (plaintext)
 * @param {string} secretData.description - Description
 * @param {Array<string>} secretData.tags - Tags for categorization
 * @param {number} secretData.createdBy - User ID of creator
 * @returns {Promise<Object>} Created secret (without value)
 */
async function createSecret(secretData) {
  const { path, value, description, tags = [], createdBy } = secretData;
  
  // Validate input
  if (!path || !value) {
    throw new Error('Path and value are required');
  }
  
  // Check if secret already exists
  const existing = await query(
    'SELECT id FROM secrets WHERE path = $1',
    [path]
  );
  
  if (existing.rows.length > 0) {
    throw new Error(`Secret with path '${path}' already exists`);
  }
  
  // Encrypt secret
  const { encryptedValue, encryptedDEK } = encryptSecret(value);
  
  // Store secret
  const result = await query(
    `INSERT INTO secrets (path, encrypted_value, encrypted_dek, description, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, path, description, tags, version, created_at`,
    [path, encryptedValue, encryptedDEK, description, JSON.stringify(tags), createdBy]
  );
  
  const secret = result.rows[0];
  
  // Audit log
  await auditLog({
    userId: createdBy,
    action: 'secret_create',
    resourceType: 'secret',
    resourcePath: path,
    result: 'success',
    metadata: { tags, description }
  });
  
  return secret;
}

/**
 * Get secret metadata (without decrypting value)
 * @param {string} path - Secret path
 * @returns {Promise<Object>} Secret metadata
 */
async function getSecretMetadata(path) {
  const result = await query(
    `SELECT s.id, s.path, s.description, s.tags, s.version, s.is_active,
            s.created_at, s.updated_at,
            u.username as created_by_username
     FROM secrets s
     JOIN users u ON s.created_by = u.id
     WHERE s.path = $1 AND s.is_active = true`,
    [path]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Secret '${path}' not found`);
  }
  
  return result.rows[0];
}

/**
 * Get secret with masked value
 * @param {string} path - Secret path
 * @param {number} userId - User ID requesting the secret
 * @returns {Promise<Object>} Secret with masked value
 */
async function getSecretMasked(path, userId) {
  const result = await query(
    `SELECT s.id, s.path, s.description, s.tags, s.version, s.encrypted_value, s.encrypted_dek,
            s.created_at, s.updated_at,
            u.username as created_by_username
     FROM secrets s
     JOIN users u ON s.created_by = u.id
     WHERE s.path = $1 AND s.is_active = true`,
    [path]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Secret '${path}' not found`);
  }
  
  const secret = result.rows[0];
  
  // Decrypt to get actual value for masking
  const plaintext = decryptSecret(secret.encrypted_value, secret.encrypted_dek);
  const maskedValue = maskSecret(plaintext);
  
  // Audit log
  await auditLog({
    userId,
    action: 'secret_read_masked',
    resourceType: 'secret',
    resourcePath: path,
    result: 'success'
  });
  
  return {
    id: secret.id,
    path: secret.path,
    value: maskedValue,
    description: secret.description,
    tags: secret.tags,
    version: secret.version,
    createdBy: secret.created_by_username,
    createdAt: secret.created_at,
    updatedAt: secret.updated_at
  };
}

/**
 * Get secret with revealed (plaintext) value
 * @param {string} path - Secret path
 * @param {number} userId - User ID requesting the secret
 * @param {string} username - Username requesting the secret
 * @param {string} ipAddress - Client IP address
 * @returns {Promise<Object>} Secret with plaintext value
 */
async function getSecretRevealed(path, userId, username, ipAddress) {
  const result = await query(
    `SELECT s.id, s.path, s.description, s.tags, s.version, s.encrypted_value, s.encrypted_dek,
            s.created_at, s.updated_at,
            u.username as created_by_username
     FROM secrets s
     JOIN users u ON s.created_by = u.id
     WHERE s.path = $1 AND s.is_active = true`,
    [path]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Secret '${path}' not found`);
  }
  
  const secret = result.rows[0];
  
  // Decrypt secret
  const plaintext = decryptSecret(secret.encrypted_value, secret.encrypted_dek);
  
  // Audit log (CRITICAL: log all reveals)
  await auditLog({
    userId,
    username,
    action: 'secret_read_reveal',
    resourceType: 'secret',
    resourcePath: path,
    result: 'success',
    ipAddress
  });
  
  return {
    id: secret.id,
    path: secret.path,
    value: plaintext,
    description: secret.description,
    tags: secret.tags,
    version: secret.version,
    createdBy: secret.created_by_username,
    createdAt: secret.created_at,
    updatedAt: secret.updated_at
  };
}

/**
 * List secrets (metadata only)
 * @param {Object} filters - Query filters
 * @param {string} filters.pathPrefix - Filter by path prefix
 * @param {Array<string>} filters.tags - Filter by tags
 * @param {number} filters.limit - Result limit
 * @param {number} filters.offset - Result offset
 * @returns {Promise<Array>} List of secrets
 */
async function listSecrets(filters = {}) {
  const conditions = ['s.is_active = true'];
  const params = [];
  let paramCount = 1;
  
  if (filters.pathPrefix) {
    conditions.push(`s.path LIKE $${paramCount++}`);
    params.push(`${filters.pathPrefix}%`);
  }
  
  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`s.tags @> $${paramCount++}::jsonb`);
    params.push(JSON.stringify(filters.tags));
  }
  
  const whereClause = conditions.join(' AND ');
  const limit = Math.min(filters.limit || 100, 1000);
  const offset = filters.offset || 0;
  
  const result = await query(
    `SELECT s.id, s.path, s.description, s.tags, s.version,
            s.created_at, s.updated_at,
            u.username as created_by_username
     FROM secrets s
     JOIN users u ON s.created_by = u.id
     WHERE ${whereClause}
     ORDER BY s.path ASC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...params, limit, offset]
  );
  
  return result.rows;
}

/**
 * Update secret
 * @param {string} path - Secret path
 * @param {Object} updates - Fields to update
 * @param {string} updates.description - New description
 * @param {Array<string>} updates.tags - New tags
 * @param {number} updatedBy - User ID making the update
 * @returns {Promise<Object>} Updated secret
 */
async function updateSecret(path, updates, updatedBy) {
  const fields = [];
  const params = [];
  let paramCount = 1;
  
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    params.push(updates.description);
  }
  
  if (updates.tags !== undefined) {
    fields.push(`tags = $${paramCount++}`);
    params.push(JSON.stringify(updates.tags));
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  fields.push(`updated_by = $${paramCount++}`);
  params.push(updatedBy);
  
  fields.push(`updated_at = NOW()`);
  
  params.push(path);
  
  const result = await query(
    `UPDATE secrets
     SET ${fields.join(', ')}
     WHERE path = $${paramCount} AND is_active = true
     RETURNING id, path, description, tags, version, updated_at`,
    params
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Secret '${path}' not found`);
  }
  
  await auditLog({
    userId: updatedBy,
    action: 'secret_update',
    resourceType: 'secret',
    resourcePath: path,
    result: 'success',
    metadata: updates
  });
  
  return result.rows[0];
}

/**
 * Rotate secret (create new version)
 * @param {string} path - Secret path
 * @param {string} newValue - New secret value
 * @param {number} userId - User ID performing rotation
 * @returns {Promise<Object>} New secret version
 */
async function rotateSecret(path, newValue, userId) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get current secret
    const currentResult = await client.query(
      'SELECT id, version, encrypted_value, encrypted_dek FROM secrets WHERE path = $1 AND is_active = true',
      [path]
    );
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Secret '${path}' not found`);
    }
    
    const currentSecret = currentResult.rows[0];
    const newVersion = currentSecret.version + 1;
    
    // Archive current version
    await client.query(
      'INSERT INTO secret_versions (secret_id, version, encrypted_value, encrypted_dek, created_by) VALUES ($1, $2, $3, $4, $5)',
      [currentSecret.id, currentSecret.version, currentSecret.encrypted_value, currentSecret.encrypted_dek, userId]
    );
    
    // Encrypt new value
    const { encryptedValue, encryptedDEK } = encryptSecret(newValue);
    
    // Update secret with new version
    const updateResult = await client.query(
      `UPDATE secrets
       SET encrypted_value = $1, encrypted_dek = $2, version = $3, updated_by = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, path, version, updated_at`,
      [encryptedValue, encryptedDEK, newVersion, userId, currentSecret.id]
    );
    
    await client.query('COMMIT');
    
    await auditLog({
      userId,
      action: 'secret_rotate',
      resourceType: 'secret',
      resourcePath: path,
      result: 'success',
      metadata: { oldVersion: currentSecret.version, newVersion }
    });
    
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete secret (soft delete)
 * @param {string} path - Secret path
 * @param {number} userId - User ID performing deletion
 * @returns {Promise<void>}
 */
async function deleteSecret(path, userId) {
  const result = await query(
    'UPDATE secrets SET is_active = false, updated_by = $1, updated_at = NOW() WHERE path = $2 AND is_active = true RETURNING id',
    [userId, path]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Secret '${path}' not found`);
  }
  
  await auditLog({
    userId,
    action: 'secret_delete',
    resourceType: 'secret',
    resourcePath: path,
    result: 'success'
  });
}

module.exports = {
  createSecret,
  getSecretMetadata,
  getSecretMasked,
  getSecretRevealed,
  listSecrets,
  updateSecret,
  rotateSecret,
  deleteSecret
};
