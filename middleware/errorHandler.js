/**
 * Centralized Error Handling Middleware
 * ─────────────────────────────────────
 * Provides:
 *  - AppError   : Operational error class with HTTP status + error code
 *  - errorHandler: Express error middleware (must be last app.use())
 *  - asyncWrap  : Wraps async route handlers so thrown errors reach errorHandler
 */

'use strict';

/* ─────────────────────────────────────────
   OPERATIONAL ERROR CLASS
───────────────────────────────────────── */
class AppError extends Error {
    /**
     * @param {string}  message    - Human-readable message (safe to expose)
     * @param {number}  statusCode - HTTP status code (400, 401, 403, 404, 429, 500…)
     * @param {string}  [code]     - Machine-readable error code for the client
     * @param {Object}  [meta]     - Extra context (field errors, etc.)
     */
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', meta = {}) {
        super(message);
        this.name        = 'AppError';
        this.statusCode  = statusCode;
        this.code        = code;
        this.meta        = meta;
        this.isOperational = true;          // distinguishes known errors from bugs
        Error.captureStackTrace(this, this.constructor);
    }
}

/* ─────────────────────────────────────────
   COMMON FACTORY HELPERS
───────────────────────────────────────── */
AppError.badRequest    = (msg, code = 'BAD_REQUEST', meta)       => new AppError(msg, 400, code, meta);
AppError.unauthorized  = (msg = 'Authentication required.')        => new AppError(msg, 401, 'UNAUTHORIZED');
AppError.forbidden     = (msg = 'Access denied.')                  => new AppError(msg, 403, 'FORBIDDEN');
AppError.notFound      = (resource = 'Resource')                   => new AppError(`${resource} not found.`, 404, 'NOT_FOUND');
AppError.conflict      = (msg, code = 'CONFLICT')                  => new AppError(msg, 409, code);
AppError.tooMany       = (msg = 'Too many requests. Please slow down.') => new AppError(msg, 429, 'RATE_LIMIT_EXCEEDED');
AppError.internal      = (msg = 'An unexpected error occurred.')   => new AppError(msg, 500, 'INTERNAL_ERROR');

/* ─────────────────────────────────────────
   ASYNC WRAPPER  (eliminates repetitive try/catch in routes)
   Usage:  app.get('/path', asyncWrap(async (req, res) => { ... }))
───────────────────────────────────────── */
const asyncWrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ─────────────────────────────────────────
   MYSQL ERROR TRANSLATOR
───────────────────────────────────────── */
function translateMySQLError(err) {
    switch (err.code) {
        case 'ER_DUP_ENTRY':
            return AppError.conflict('A record with this value already exists.', 'DUPLICATE_ENTRY');
        case 'ER_NO_REFERENCED_ROW_2':
            return AppError.badRequest('Referenced record does not exist.', 'FOREIGN_KEY_VIOLATION');
        case 'ER_ROW_IS_REFERENCED_2':
            return AppError.conflict('Cannot delete — other records depend on this.', 'FOREIGN_KEY_CONSTRAINT');
        case 'ECONNREFUSED':
        case 'ER_ACCESS_DENIED_ERROR':
            return AppError.internal('Database connection error.');
        default:
            return null;
    }
}

/* ─────────────────────────────────────────
   JWT ERROR TRANSLATOR
───────────────────────────────────────── */
function translateJWTError(err) {
    if (err.name === 'JsonWebTokenError')  return AppError.unauthorized('Invalid token.');
    if (err.name === 'TokenExpiredError')  return AppError.unauthorized('Token has expired. Please log in again.');
    if (err.name === 'NotBeforeError')     return AppError.unauthorized('Token not yet active.');
    return null;
}

/* ─────────────────────────────────────────
   MULTER ERROR TRANSLATOR
───────────────────────────────────────── */
function translateMulterError(err) {
    const multer = require('multer');
    if (err instanceof multer.MulterError) {
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                return AppError.badRequest('File is too large. Maximum size is 5 MB.', 'FILE_TOO_LARGE');
            case 'LIMIT_FILE_COUNT':
                return AppError.badRequest('Too many files uploaded.', 'TOO_MANY_FILES');
            case 'LIMIT_UNEXPECTED_FILE':
                return AppError.badRequest(`Unexpected form field: ${err.field}`, 'UNEXPECTED_FIELD');
            default:
                return AppError.badRequest(err.message, 'UPLOAD_ERROR');
        }
    }
    return null;
}

/* ─────────────────────────────────────────
   GLOBAL EXPRESS ERROR MIDDLEWARE
   Must be registered LAST with app.use(errorHandler)
───────────────────────────────────────── */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    const isDev = process.env.NODE_ENV !== 'production';

    /* --- Translate well-known third-party errors into AppErrors --- */
    const translated =
        translateMySQLError(err) ||
        translateJWTError(err)   ||
        translateMulterError(err);

    const error = translated || err;

    /* --- Determine response shape --- */
    const statusCode = error.statusCode || 500;
    const isOperational = error.isOperational === true;

    /* Log unexpected bugs at ERROR level; operational errors at WARN */
    if (!isOperational) {
        console.error('💥 UNHANDLED ERROR:', {
            message : err.message,
            stack   : err.stack,
            path    : req.path,
            method  : req.method,
            ip      : req.ip,
        });
    } else if (isDev) {
        console.warn(`⚠️  [${statusCode}] ${error.message} — ${req.method} ${req.path}`);
    }

    /* Build the response */
    const body = {
        success    : false,
        message    : isOperational ? error.message : 'An unexpected error occurred.',
        code       : error.code || 'INTERNAL_ERROR',
        ...(error.meta && Object.keys(error.meta).length ? { details: error.meta } : {}),
        // Only expose stack in development for non-operational errors
        ...(isDev && !isOperational ? { stack: err.stack } : {}),
    };

    res.status(statusCode).json(body);
};

/* ─────────────────────────────────────────
   404 HANDLER  (register before errorHandler)
───────────────────────────────────────── */
const notFoundHandler = (req, res, next) => {
    next(AppError.notFound(`Route ${req.method} ${req.path}`));
};

/* ─────────────────────────────────────────
   EXPORTS
───────────────────────────────────────── */
module.exports = {
    AppError,
    asyncWrap,
    errorHandler,
    notFoundHandler,
};
