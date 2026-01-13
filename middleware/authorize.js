const { evaluateAccess } = require('./policyEngine');
const { auditLog } = require('./auditService');

/**
 * Authorization middleware
 * Enforces policy-based access control
 * @param {string} action - Required action (read, write, delete, etc.)
 * @param {Function} resourcePathExtractor - Function to extract resource path from request
 */
function authorize(action, resourcePathExtractor) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }
      
      // Extract resource path from request
      const resourcePath = typeof resourcePathExtractor === 'function'
        ? resourcePathExtractor(req)
        : req.params.path || req.body.path;
      
      if (!resourcePath) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Resource path is required'
        });
      }
      
      // Evaluate access
      const result = await evaluateAccess({
        roles: req.user.roles,
        action,
        resourcePath,
        ipAddress: req.ip,
        timestamp: new Date()
      });
      
      // Audit the authorization decision
      await auditLog({
        userId: req.user.userId,
        username: req.user.username,
        action: `authz_${action}`,
        resourceType: 'secret',
        resourcePath,
        result: result.allowed ? 'allowed' : 'denied',
        reason: result.reason,
        ipAddress: req.ip,
        metadata: {
          evaluatedPolicies: result.policies
        }
      });
      
      if (!result.allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
          reason: result.reason,
          evaluatedPolicies: result.policies,
          suggestion: result.suggestion
        });
      }
      
      // Attach authorization result to request
      req.authz = result;
      
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        error: 'Authorization failed',
        message: error.message
      });
    }
  };
}

module.exports = {
  authorize
};
