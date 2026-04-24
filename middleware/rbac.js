/**
 * Role-Based Access Control (RBAC) Middleware
 * ─────────────────────────────────────────────
 * Provides authentication and authorization middleware for API endpoints.
 *
 * Exports:
 *  - authenticateToken  : Verifies JWT (header or cookie), attaches req.user
 *  - requireAdmin       : Asserts req.user.role === 'admin'
 *  - requireAuth        : Asserts req.user exists (any authenticated role)
 *  - adminOnly          : [authenticateToken, requireAdmin]
 *  - authOnly           : [authenticateToken, requireAuth]
 */

'use strict';

const jwt = require('jsonwebtoken');

const IS_DEV = process.env.NODE_ENV !== 'production';

/* ─────────────────────────────────────────
   HELPER — extract token from request
───────────────────────────────────────── */
function extractToken(req) {
    // 1. Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        // Guard against literal string "undefined" / "null" sent by buggy clients
        if (token && token !== 'undefined' && token !== 'null') {
            return token;
        }
    }

    // 2. httpOnly cookie (preferred in production)
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }

    return null;
}

/* ─────────────────────────────────────────
   authenticateToken
   Verifies the JWT and attaches the decoded payload to req.user.
   Returns 401 if no token, 403 if invalid/expired.
───────────────────────────────────────── */
const authenticateToken = (req, res, next) => {
    if (IS_DEV) {
        console.log(`[Auth] ${req.method} ${req.path}`);
    }

    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({
            success : false,
            message : 'Authentication required. Please log in.',
            code    : 'UNAUTHORIZED',
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch (err) {
        const message =
            err.name === 'TokenExpiredError'
                ? 'Session expired. Please log in again.'
                : 'Invalid token. Please log in again.';

        return res.status(403).json({
            success : false,
            message,
            code    : err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        });
    }
};

/* ─────────────────────────────────────────
   requireAdmin
   Must be used AFTER authenticateToken.
   Returns 403 if the authenticated user is not an admin.
───────────────────────────────────────── */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success : false,
            message : 'Authentication required.',
            code    : 'UNAUTHORIZED',
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success : false,
            message : 'Access denied. Administrator privileges required.',
            code    : 'FORBIDDEN',
        });
    }

    return next();
};

/* ─────────────────────────────────────────
   requireAuth
   Must be used AFTER authenticateToken.
   Returns 401 if req.user is somehow absent (belt-and-suspenders).
───────────────────────────────────────── */
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success : false,
            message : 'Authentication required.',
            code    : 'UNAUTHORIZED',
        });
    }
    return next();
};

/* ─────────────────────────────────────────
   COMBINED MIDDLEWARE CHAINS
───────────────────────────────────────── */

/** Authenticate + require admin role */
const adminOnly = [authenticateToken, requireAdmin];

/** Authenticate + require any authenticated user */
const authOnly  = [authenticateToken, requireAuth];

/* ─────────────────────────────────────────
   EXPORTS
───────────────────────────────────────── */
module.exports = {
    authenticateToken,
    requireAdmin,
    requireAuth,
    adminOnly,
    authOnly,
};
