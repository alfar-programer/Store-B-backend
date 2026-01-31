/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides authentication and authorization middleware for API endpoints
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.split(' ')[1];

    // Handle "undefined" or "null" strings being passed as tokens
    if (token === 'undefined' || token === 'null') {
        token = null;
    }

    // If no token in headers, check cookies
    if (!token && req.cookies) {
        token = req.cookies.token;
    }

    if (!token) {
        console.warn('🔓 Auth Failed: No token provided in headers or cookies for path:', req.path);
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('🔐 Auth Failed: Invalid or expired token for path:', req.path, 'Error:', error.message);
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.'
        });
    }
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }

    next();
};

/**
 * Require authentication (any authenticated user)
 */
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }
    next();
};

/**
 * Combined middleware: authenticate + require admin
 */
const adminOnly = [authenticateToken, requireAdmin];

/**
 * Combined middleware: authenticate + require auth
 */
const authOnly = [authenticateToken, requireAuth];

module.exports = {
    authenticateToken,
    requireAdmin,
    requireAuth,
    adminOnly,
    authOnly
};
