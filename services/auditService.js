const crypto = require('crypto');
const { auditQuery } = require('../db/connection');
const { generateHash } = require('./encryptionService');

/**
 * Audit Service
 * Implements immutable, cryptographically-chained audit logging
 */

/**
 * Get the hash of the most recent audit log entry
 * @returns {Promise<string>} Previous hash or empty string
 */
async function getPreviousHash() {
  try {
    const result = await auditQuery(
      'SELECT current_hash FROM audit_logs ORDER BY id DESC LIMIT 1'
    );
    return result.rows.length > 0 ? result.rows[0].current_hash : '';
  } catch (error) {
    console.error('Error getting previous hash:', error);
    return '';
  }
}

/**
 * Log an audit event
 * @param {Object} event - Audit event data
 * @param {number} event.userId - User ID (optional for unauthenticated events)
 * @param {string} event.username - Username
 * @param {string} event.action - Action performed
 * @param {string} event.resourceType - Type of resource
 * @param {string} event.resourcePath - Path to resource
 * @param {string} event.result - Result (success, denied, error)
 * @param {string} event.reason - Reason for result (optional)
 * @param {string} event.ipAddress - Client IP address (optional)
 * @param {string} event.userAgent - Client user agent (optional)
 * @param {string} event.requestId - Request ID for correlation (optional)
 * @param {Object} event.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created audit log entry
 */
async function auditLog(event) {
  try {
    // Get previous hash for chaining
    const previousHash = await getPreviousHash();
    
    // Create event data string for hashing
    const eventData = JSON.stringify({
      userId: event.userId,
      username: event.username,
      action: event.action,
      resourceType: event.resourceType,
      resourcePath: event.resourcePath,
      result: event.result,
      timestamp: new Date().toISOString()
    });
    
    // Generate current hash (chained with previous)
    const currentHash = generateHash(eventData, previousHash);
    
    // Insert audit log
    const result = await auditQuery(
      `INSERT INTO audit_logs (
        user_id, username, action, resource_type, resource_path,
        result, reason, ip_address, user_agent, request_id,
        metadata, previous_hash, current_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        event.userId || null,
        event.username || 'system',
        event.action,
        event.resourceType || null,
        event.resourcePath || null,
        event.result,
        event.reason || null,
        event.ipAddress || null,
        event.userAgent || null,
        event.requestId || null,
        JSON.stringify(event.metadata || {}),
        previousHash,
        currentHash
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    // Critical: Audit logging failure should not break the application
    // but should be logged to system logs
    console.error('CRITICAL: Audit log failure:', error);
    
    // In production, this should trigger alerts
    // For now, we'll continue execution
    return null;
  }
}

/**
 * Query audit logs with filters
 * @param {Object} filters - Query filters
 * @param {number} filters.userId - Filter by user ID
 * @param {string} filters.username - Filter by username
 * @param {string} filters.action - Filter by action
 * @param {string} filters.resourcePath - Filter by resource path
 * @param {string} filters.result - Filter by result
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {number} filters.limit - Result limit (default 100, max 1000)
 * @param {number} filters.offset - Result offset for pagination
 * @returns {Promise<Array>} Audit log entries
 */
async function queryAuditLogs(filters = {}) {
  const conditions = [];
  const params = [];
  let paramCount = 1;
  
  if (filters.userId) {
    conditions.push(`user_id = $${paramCount++}`);
    params.push(filters.userId);
  }
  
  if (filters.username) {
    conditions.push(`username = $${paramCount++}`);
    params.push(filters.username);
  }
  
  if (filters.action) {
    conditions.push(`action = $${paramCount++}`);
    params.push(filters.action);
  }
  
  if (filters.resourcePath) {
    conditions.push(`resource_path LIKE $${paramCount++}`);
    params.push(`%${filters.resourcePath}%`);
  }
  
  if (filters.result) {
    conditions.push(`result = $${paramCount++}`);
    params.push(filters.result);
  }
  
  if (filters.startDate) {
    conditions.push(`timestamp >= $${paramCount++}`);
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    conditions.push(`timestamp <= $${paramCount++}`);
    params.push(filters.endDate);
  }
  
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';
  
  const limit = Math.min(filters.limit || 100, 1000);
  const offset = filters.offset || 0;
  
  const query = `
    SELECT 
      id, user_id, username, action, resource_type, resource_path,
      result, reason, ip_address, timestamp, metadata
    FROM audit_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $${paramCount++} OFFSET $${paramCount++}
  `;
  
  params.push(limit, offset);
  
  const result = await auditQuery(query, params);
  return result.rows;
}

/**
 * Verify audit log chain integrity
 * Checks if the cryptographic chain is intact
 * @param {number} limit - Number of recent entries to verify (default 1000)
 * @returns {Promise<Object>} { valid: boolean, brokenAt: number|null }
 */
async function verifyAuditChain(limit = 1000) {
  const result = await auditQuery(
    `SELECT id, user_id, username, action, resource_type, resource_path,
            result, timestamp, previous_hash, current_hash
     FROM audit_logs
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  );
  
  const logs = result.rows;
  
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const expectedPreviousHash = i === 0 ? '' : logs[i - 1].current_hash;
    
    if (log.previous_hash !== expectedPreviousHash) {
      return {
        valid: false,
        brokenAt: log.id,
        message: `Chain broken at log ID ${log.id}`
      };
    }
    
    // Verify current hash
    const eventData = JSON.stringify({
      userId: log.user_id,
      username: log.username,
      action: log.action,
      resourceType: log.resource_type,
      resourcePath: log.resource_path,
      result: log.result,
      timestamp: log.timestamp.toISOString()
    });
    
    const expectedCurrentHash = generateHash(eventData, log.previous_hash);
    
    if (log.current_hash !== expectedCurrentHash) {
      return {
        valid: false,
        brokenAt: log.id,
        message: `Hash mismatch at log ID ${log.id}`
      };
    }
  }
  
  return {
    valid: true,
    brokenAt: null,
    message: `Verified ${logs.length} audit log entries`
  };
}

/**
 * Export audit logs to CSV format
 * @param {Object} filters - Query filters (same as queryAuditLogs)
 * @returns {Promise<string>} CSV formatted string
 */
async function exportAuditLogsCSV(filters = {}) {
  const logs = await queryAuditLogs({ ...filters, limit: 10000 });
  
  // CSV header
  const header = 'ID,Timestamp,Username,Action,Resource Type,Resource Path,Result,Reason,IP Address\n';
  
  // CSV rows
  const rows = logs.map(log => {
    return [
      log.id,
      log.timestamp.toISOString(),
      log.username || '',
      log.action,
      log.resource_type || '',
      log.resource_path || '',
      log.result,
      log.reason || '',
      log.ip_address || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  }).join('\n');
  
  return header + rows;
}

module.exports = {
  auditLog,
  queryAuditLogs,
  verifyAuditChain,
  exportAuditLogsCSV
};
