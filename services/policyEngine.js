const { query } = require('../db/connection');

/**
 * Policy Engine
 * Evaluates access control policies for resource access
 */

/**
 * Check if a path pattern matches a resource path
 * Supports wildcards (*) in patterns
 * @param {string} pattern - Path pattern (e.g., "prod/*")
 * @param {string} path - Resource path (e.g., "prod/database/password")
 * @returns {boolean} True if pattern matches path
 */
function matchesPattern(pattern, path) {
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*'); // Replace * with .*
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Evaluate if user has permission to perform action on resource
 * @param {Object} context - Authorization context
 * @param {Array<string>} context.roles - User roles
 * @param {string} context.action - Action to perform
 * @param {string} context.resourcePath - Path to resource
 * @param {string} context.ipAddress - Client IP address (optional)
 * @param {Date} context.timestamp - Request timestamp (optional)
 * @returns {Promise<Object>} { allowed: boolean, reason: string, policies: Array }
 */
async function evaluateAccess(context) {
  const { roles, action, resourcePath, ipAddress, timestamp = new Date() } = context;
  
  if (!roles || roles.length === 0) {
    return {
      allowed: false,
      reason: 'No roles assigned to user',
      policies: []
    };
  }
  
  // Fetch all active policies that apply to user's roles
  const result = await query(
    `SELECT id, name, effect, roles, actions, resources, conditions, priority
     FROM policies
     WHERE is_active = true
     ORDER BY priority DESC, id ASC`
  );
  
  const allPolicies = result.rows;
  const applicablePolicies = [];
  const evaluatedPolicies = [];
  
  // Filter policies that apply to user's roles
  for (const policy of allPolicies) {
    const policyRoles = policy.roles || [];
    const hasRole = roles.some(role => policyRoles.includes(role) || policyRoles.includes('*'));
    
    if (!hasRole) {
      continue;
    }
    
    // Check if action is in policy actions
    const policyActions = policy.actions || [];
    const hasAction = policyActions.includes(action) || policyActions.includes('*');
    
    if (!hasAction) {
      evaluatedPolicies.push({
        policyId: policy.id,
        policyName: policy.name,
        matched: false,
        reason: `Action '${action}' not in policy actions`
      });
      continue;
    }
    
    // Check if resource path matches any policy resource pattern
    const policyResources = policy.resources || [];
    const matchesResource = policyResources.some(pattern => 
      matchesPattern(pattern, resourcePath)
    );
    
    if (!matchesResource) {
      evaluatedPolicies.push({
        policyId: policy.id,
        policyName: policy.name,
        matched: false,
        reason: `Resource '${resourcePath}' does not match policy patterns`
      });
      continue;
    }
    
    // Check conditional constraints
    const conditions = policy.conditions || {};
    let conditionsMet = true;
    let conditionFailureReason = '';
    
    // IP range check
    if (conditions.ip_range && ipAddress) {
      // Simple IP range check (can be enhanced with CIDR notation)
      const allowedRanges = Array.isArray(conditions.ip_range) 
        ? conditions.ip_range 
        : [conditions.ip_range];
      
      const ipMatches = allowedRanges.some(range => {
        if (range.includes('/')) {
          // CIDR notation (simplified check)
          return ipAddress.startsWith(range.split('/')[0].split('.').slice(0, 3).join('.'));
        }
        return ipAddress === range;
      });
      
      if (!ipMatches) {
        conditionsMet = false;
        conditionFailureReason = `IP address ${ipAddress} not in allowed ranges`;
      }
    }
    
    // Time of day check
    if (conditions.time_of_day && timestamp) {
      const currentHour = timestamp.getUTCHours();
      const [startTime, endTime] = conditions.time_of_day.split('-');
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      if (currentHour < startHour || currentHour >= endHour) {
        conditionsMet = false;
        conditionFailureReason = `Access only allowed between ${conditions.time_of_day} UTC`;
      }
    }
    
    if (!conditionsMet) {
      evaluatedPolicies.push({
        policyId: policy.id,
        policyName: policy.name,
        matched: false,
        reason: conditionFailureReason
      });
      continue;
    }
    
    // Policy matches
    applicablePolicies.push(policy);
    evaluatedPolicies.push({
      policyId: policy.id,
      policyName: policy.name,
      matched: true,
      effect: policy.effect
    });
  }
  
  // Evaluate policies: explicit deny wins, then allow
  const hasDeny = applicablePolicies.some(p => p.effect === 'deny');
  const hasAllow = applicablePolicies.some(p => p.effect === 'allow');
  
  if (hasDeny) {
    const denyPolicy = applicablePolicies.find(p => p.effect === 'deny');
    return {
      allowed: false,
      reason: `Explicitly denied by policy '${denyPolicy.name}'`,
      policies: evaluatedPolicies
    };
  }
  
  if (hasAllow) {
    const allowPolicy = applicablePolicies.find(p => p.effect === 'allow');
    return {
      allowed: true,
      reason: `Granted by policy '${allowPolicy.name}'`,
      policies: evaluatedPolicies
    };
  }
  
  // Default deny
  return {
    allowed: false,
    reason: `No policy grants '${action}' on '${resourcePath}'`,
    policies: evaluatedPolicies,
    suggestion: 'Request access via security team or check your role assignments'
  };
}

/**
 * Simulate policy evaluation (for testing)
 * @param {number} userId - User ID
 * @param {string} action - Action to test
 * @param {string} resourcePath - Resource path to test
 * @returns {Promise<Object>} Evaluation result
 */
async function simulateAccess(userId, action, resourcePath) {
  // Get user roles
  const userResult = await query(
    `SELECT COALESCE(json_agg(role) FILTER (WHERE role IS NOT NULL), '[]') as roles
     FROM user_roles
     WHERE user_id = $1`,
    [userId]
  );
  
  const roles = userResult.rows[0]?.roles || [];
  
  return await evaluateAccess({
    roles,
    action,
    resourcePath
  });
}

module.exports = {
  evaluateAccess,
  simulateAccess,
  matchesPattern
};
