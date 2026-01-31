/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides authentication and authorization middleware for API endpoints
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
    // Log request details for debugging
    console.log(`--- Auth Debug [${req.method}] ${req.path} ---`);
    console.log('Origin:', req.headers.origin);
    console.log('Authorization Header:', req.headers.authorization ? 'Present' : 'MISSING');
    console.log('Cookies Present:', req.cookies ? Object.keys(req.cookies) : 'NONE');

    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.split(' ')[1];

    if (token === 'undefined' || token === 'null') {
        console.warn('⚠️ Token is string "undefined" or "null"');
        token = null;
    }

    if (!token && req.cookies) {
        token = req.cookies.token;
        if (token) console.log('✅ Found token in cookie');
    }

    if (!token) {
        console.warn('❌ Auth Failed: No token found in headers or cookies');
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('✅ Auth Success: User ID', decoded.id);
        next();
    } catch (error) {
        console.error('❌ Auth Failed: Invalid/Expired Token -', error.message);
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
