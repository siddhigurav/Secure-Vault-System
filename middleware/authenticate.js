const { verifyToken } = require('../services/authService');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user context to request
 */
function authenticate(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Attach user context to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      roles: decoded.roles || []
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user context if token is present, but doesn't require it
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        roles: decoded.roles || []
      };
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}

/**
 * Role-based access control middleware
 * Requires user to have at least one of the specified roles
 * @param {Array<string>} allowedRoles - List of allowed roles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of the following roles: ${allowedRoles.join(', ')}`,
        userRoles
      });
    }
    
    next();
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  requireRole
};
