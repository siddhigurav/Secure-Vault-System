const express = require('express');
const { queryAuditLogs, verifyAuditChain, exportAuditLogsCSV } = require('../services/auditService');
const { authenticate, requireRole } = require('../middleware/authenticate');

const router = express.Router();

/**
 * GET /api/audit
 * Query audit logs with filters
 */
router.get('/', authenticate, requireRole('security-admin', 'auditor'), async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : undefined,
      username: req.query.username,
      action: req.query.action,
      resourcePath: req.query.resourcePath,
      result: req.query.result,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    
    const logs = await queryAuditLogs(filters);
    
    res.json({
      logs,
      count: logs.length,
      filters
    });
  } catch (error) {
    console.error('Query audit logs error:', error);
    res.status(500).json({
      error: 'Failed to query audit logs',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/verify
 * Verify audit log chain integrity
 */
router.get('/verify', authenticate, requireRole('security-admin'), async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    const result = await verifyAuditChain(limit);
    
    res.json({
      verification: result
    });
  } catch (error) {
    console.error('Verify audit chain error:', error);
    res.status(500).json({
      error: 'Failed to verify audit chain',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/export
 * Export audit logs as CSV
 */
router.get('/export', authenticate, requireRole('security-admin', 'auditor'), async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : undefined,
      username: req.query.username,
      action: req.query.action,
      resourcePath: req.query.resourcePath,
      result: req.query.result,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
    };
    
    const csv = await exportAuditLogsCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      error: 'Failed to export audit logs',
      message: error.message
    });
  }
});

module.exports = router;
