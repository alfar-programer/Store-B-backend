const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const slowDown = require('express-slow-down');

/* ======================
   REDIS CONNECTION
====================== */
let redisClient = null;
let isRedisAvailable = false;

// Initialize Redis with fallback
function initializeRedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            retryStrategy(times) {
                // Stop retrying after 3 attempts to prevent log spam
                if (times > 3) {
                    console.warn('⚠️  Redis connection failed 3 times, disabling Redis for this session');
                    return null;
                }
                const delay = Math.min(times * 200, 1000); // Backoff: 200ms, 400ms, 600ms...
                return delay;
            },
            reconnectOnError(err) {
                console.error('Redis reconnect on error:', err.message);
                return true;
            }
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected successfully');
            isRedisAvailable = true;
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis is ready to accept commands');
            isRedisAvailable = true;
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message);
            console.warn('⚠️  Falling back to memory store for rate limiting');
            isRedisAvailable = false;
        });

        redisClient.on('close', () => {
            console.warn('⚠️  Redis connection closed');
            isRedisAvailable = false;
        });

        return redisClient;
    } catch (error) {
        console.error('❌ Failed to initialize Redis:', error.message);
        console.warn('⚠️  Using memory store for rate limiting (not recommended for production)');
        isRedisAvailable = false;
        return null;
    }
}

// Initialize Redis on module load
initializeRedis();

// Get Redis store or fallback to memory
function getStore(prefix = 'rl:') {
    if (isRedisAvailable && redisClient) {
        return new RedisStore({
            client: redisClient,
            prefix: prefix,
        });
    }
    return undefined; // express-rate-limit will use memory store
}

/* ======================
   SECURITY EVENT LOGGER
====================== */
async function logSecurityEvent(pool, eventData) {
    if (!pool) {
        // console.warn('⚠️ Cannot log security event: Database pool not available');
        return;
    }

    try {
        const {
            ip,
            event_type,
            endpoint,
            user_id = null,
            email = null,
            user_agent = null,
            success = false,
            metadata = {}
        } = eventData;

        await pool.query(
            `INSERT INTO security_events 
       (ip, event_type, endpoint, user_id, email, user_agent, success, metadata, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                ip,
                event_type,
                endpoint,
                user_id,
                email,
                user_agent,
                success,
                JSON.stringify(metadata)
            ]
        );
    } catch (error) {
        console.error('❌ Failed to log security event:', error.message);
    }
}

/* ======================
   IP MANAGEMENT
====================== */
// Check if IP is blacklisted (expects req.pool to be available)
const checkBlacklist = (req, res, next) => {
    const pool = req.pool;
    if (!pool) return next();

    (async () => {
        try {
            const ip = req.ip || req.connection.remoteAddress;

            const [blocked] = await pool.query(
                `SELECT * FROM blocked_ips 
         WHERE ip = ? AND (blocked_until > NOW() OR auto_unblock = FALSE)`,
                [ip]
            );

            if (blocked.length > 0) {
                const blockInfo = blocked[0];

                await logSecurityEvent(pool, {
                    ip,
                    event_type: 'blocked_ip_attempt',
                    endpoint: req.path,
                    user_agent: req.get('user-agent'),
                    success: false,
                    metadata: { reason: blockInfo.reason }
                });

                return res.status(403).json({
                    success: false,
                    message: 'Access denied',
                    error: 'IP_BLOCKED'
                });
            }

            next();
        } catch (error) {
            console.error('❌ Blacklist check error:', error.message);
            next(); // Don't block on error
        }
    })();
};

// Check if IP is whitelisted
function checkWhitelist(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const whitelist = (process.env.IP_WHITELIST || '127.0.0.1,::1').split(',').map(i => i.trim());

    if (whitelist.includes(ip)) {
        req.isWhitelisted = true;
    }

    next();
}

// Skip rate limiting for whitelisted IPs
function skipWhitelisted(req) {
    return req.isWhitelisted === true;
}

// Skip rate limiting for admin accounts OR whitelisted IPs
function skipIfAdmin(req) {
    if (req.isWhitelisted === true) return true;

    try {
        // Extract token from Authorization header or cookie
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const t = authHeader.slice(7).trim();
            if (t && t !== 'undefined' && t !== 'null') token = t;
        }
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) return false;

        // Verify the token (safe: uses the same secret as authenticateToken)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded?.role === 'admin';
    } catch {
        // Invalid / expired token — fall through to normal rate limiting
        return false;
    }
}

/* ======================
   RATE LIMITERS
====================== */

// Login Rate Limiter - 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_LOGIN || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_LOGIN || 5),
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipWhitelisted,
    store: getStore('rl:login:'),
    handler: async (req, res) => {
        if (req.pool) {
            await logSecurityEvent(req.pool, {
                ip: req.ip,
                event_type: 'rate_limit_exceeded',
                endpoint: req.path,
                email: req.body?.email,
                user_agent: req.get('user-agent'),
                success: false,
                metadata: { limit_type: 'login' }
            });
        }

        res.status(429).json({
            success: false,
            message: 'Too many login attempts. Please try again later.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_LOGIN || 15) * 60)
        });
    }
});

// Signup Rate Limiter - 3 signups per hour per IP
const signupLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_SIGNUP || 60) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_SIGNUP || 3),
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipWhitelisted,
    store: getStore('rl:signup:'),
    handler: async (req, res) => {
        if (req.pool) {
            await logSecurityEvent(req.pool, {
                ip: req.ip,
                event_type: 'rate_limit_exceeded',
                endpoint: req.path,
                email: req.body?.email,
                user_agent: req.get('user-agent'),
                success: false,
                metadata: { limit_type: 'signup' }
            });
        }

        res.status(429).json({
            success: false,
            message: 'Too many signup attempts. Please try again later.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_SIGNUP || 60) * 60)
        });
    }
});

// Global API Rate Limiter - 100 requests per 15 minutes
// Admin accounts are excluded from this limiter (see skipIfAdmin)
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_GLOBAL || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_GLOBAL || 100),
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipIfAdmin,
    store: getStore('rl:global:'),
    handler: async (req, res) => {
        if (req.pool) {
            await logSecurityEvent(req.pool, {
                ip: req.ip,
                event_type: 'rate_limit_exceeded',
                endpoint: req.path,
                user_agent: req.get('user-agent'),
                success: false,
                metadata: { limit_type: 'global' }
            });
        }

        res.status(429).json({
            success: false,
            message: 'Too many requests. Please slow down.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_GLOBAL || 15) * 60)
        });
    }
});

// Verification Rate Limiter - 5 attempts per 15 minutes
const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipWhitelisted,
    store: getStore('rl:verification:'),
    handler: async (req, res) => {
        // Can add logging here using req.pool if needed
        res.status(429).json({
            success: false,
            message: 'Too many verification attempts, please try again later.',
            error: 'RATE_LIMIT_EXCEEDED'
        });
    }
});

// Resend Rate Limiter - 3 requests per hour
const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipWhitelisted,
    store: getStore('rl:resend:'),
    handler: async (req, res) => {
        // Can add logging here using req.pool if needed
        res.status(429).json({
            success: false,
            message: 'Too many resend requests, please try again later.',
            error: 'RATE_LIMIT_EXCEEDED'
        });
    }
});

/* ======================
   PROGRESSIVE DELAYS
====================== */
const progressiveDelay = (type = 'login') => {
    if (process.env.PROGRESSIVE_DELAY_ENABLED !== 'true') {
        return (req, res, next) => next();
    }

    return slowDown({
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 1, // Start delaying after 1st request
        delayMs: (hits) => {
            if (hits <= 1) return 0; // No delay for first attempt
            if (hits === 2) return parseInt(process.env.DELAY_ATTEMPT_2 || 1000); // 1s
            if (hits === 3) return parseInt(process.env.DELAY_ATTEMPT_3 || 2000); // 2s
            if (hits >= 4) return parseInt(process.env.DELAY_ATTEMPT_4 || 5000); // 5s
            return 0;
        },
        skip: skipWhitelisted,
        store: getStore(`rl:delay:${type}:`), // Use prefix instead of custom keyGenerator
        // express-slow-down might default to ip-based key if no keyGenerator provided, 
        // which matches our needs.
        validate: {
            // Suppress validation warning for custom key generator if we needed it, 
            // but we are using default key (IP) + prefix, so this should be fine.
            // If express-slow-down complains about keyGenerator not matching, we'll see.
        }
    });
};

/* ======================
   CAPTCHA VERIFICATION
====================== */
async function verifyCaptcha(options = {}) {
    const { required = false, requiredAfter = null } = options;

    return async (req, res, next) => {
        // Skip if CAPTCHA not configured
        if (!process.env.RECAPTCHA_SECRET_KEY) {
            // console.warn('⚠️  CAPTCHA verification skipped: RECAPTCHA_SECRET_KEY not configured');
            return next();
        }

        // Skip for whitelisted IPs
        if (req.isWhitelisted) {
            return next();
        }

        const captchaToken = req.body?.captchaToken;

        // Check if CAPTCHA is required
        const shouldRequire = required || (requiredAfter && req.rateLimit?.current >= requiredAfter);

        if (shouldRequire && !captchaToken) {
            return res.status(400).json({
                success: false,
                message: 'CAPTCHA verification required',
                error: 'CAPTCHA_REQUIRED'
            });
        }

        // If token provided, verify it
        if (captchaToken) {
            try {
                const axios = require('axios');
                const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

                const response = await axios.post(verifyUrl, null, {
                    params: {
                        secret: process.env.RECAPTCHA_SECRET_KEY,
                        response: captchaToken,
                        remoteip: req.ip
                    }
                });

                const { success, score, 'error-codes': errorCodes } = response.data;

                if (!success) {
                    // Use req.pool if available (preferred), otherwise nothing
                    const pool = req.pool;
                    if (pool) {
                        await logSecurityEvent(pool, {
                            ip: req.ip,
                            event_type: 'captcha_failed',
                            endpoint: req.path,
                            email: req.body?.email,
                            user_agent: req.get('user-agent'),
                            success: false,
                            metadata: { errorCodes }
                        });
                    }

                    return res.status(400).json({
                        success: false,
                        message: 'CAPTCHA verification failed',
                        error: 'CAPTCHA_INVALID'
                    });
                }

                // For reCAPTCHA v3, check score
                if (score !== undefined) {
                    const threshold = parseFloat(process.env.CAPTCHA_THRESHOLD || 0.5);
                    if (score < threshold) {
                        const pool = req.pool;
                        if (pool) {
                            await logSecurityEvent(pool, {
                                ip: req.ip,
                                event_type: 'captcha_failed',
                                endpoint: req.path,
                                email: req.body?.email,
                                user_agent: req.get('user-agent'),
                                success: false,
                                metadata: { score, threshold }
                            });
                        }

                        return res.status(400).json({
                            success: false,
                            message: 'CAPTCHA score too low. Please try again.',
                            error: 'CAPTCHA_SCORE_LOW'
                        });
                    }
                }

                // CAPTCHA verified successfully
                req.captchaVerified = true;
            } catch (error) {
                console.error('❌ CAPTCHA verification error:', error.message);

                // Don't block on CAPTCHA service errors in development
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('⚠️  CAPTCHA verification failed but allowing in development');
                    return next();
                }

                return res.status(500).json({
                    success: false,
                    message: 'CAPTCHA verification service error',
                    error: 'CAPTCHA_SERVICE_ERROR'
                });
            }
        }

        next();
    };
}

/* ======================
   BLOCK IP HELPER
====================== */
async function blockIP(pool, ip, reason = 'rate_limit', durationMinutes = null, blockedBy = 'system') {
    if (!pool) return;

    try {
        const duration = durationMinutes || parseInt(process.env.AUTO_UNBLOCK_DURATION || 15);
        const blockedUntil = new Date(Date.now() + duration * 60 * 1000);

        // Check if IP is already blocked
        const [existing] = await pool.query('SELECT * FROM blocked_ips WHERE ip = ?', [ip]);

        if (existing.length > 0) {
            // Update existing block
            await pool.query(
                `UPDATE blocked_ips 
         SET blocked_until = ?, block_count = block_count + 1, updated_at = NOW(), reason = ?
         WHERE ip = ?`,
                [blockedUntil, reason, ip]
            );

            // Check if should be permanently banned
            const [updated] = await pool.query('SELECT block_count FROM blocked_ips WHERE ip = ?', [ip]);
            if (updated[0].block_count >= parseInt(process.env.PERMANENT_BAN_THRESHOLD || 10)) {
                await pool.query('UPDATE blocked_ips SET auto_unblock = FALSE WHERE ip = ?', [ip]);
                console.log(`🚫 IP ${ip} permanently banned after ${updated[0].block_count} blocks`);
            }
        } else {
            // Create new block
            await pool.query(
                `INSERT INTO blocked_ips 
         (ip, reason, blocked_until, auto_unblock, block_count, blocked_by, created_at, updated_at) 
         VALUES (?, ?, ?, TRUE, 1, ?, NOW(), NOW())`,
                [ip, reason, blockedUntil, blockedBy]
            );
        }

        await logSecurityEvent(pool, {
            ip,
            event_type: 'ip_blocked',
            endpoint: '/system',
            success: true,
            metadata: { reason, duration, blockedBy }
        });

        console.log(`🚫 Blocked IP ${ip} for ${duration} minutes (reason: ${reason})`);
    } catch (error) {
        console.error('❌ Failed to block IP:', error.message);
    }
}

/* ======================
   EXPORTS
====================== */
module.exports = {
    redisClient,
    isRedisAvailable,
    loginLimiter,
    signupLimiter,
    globalLimiter,
    verificationLimiter,
    resendLimiter,
    checkBlacklist,
    checkWhitelist,
    verifyCaptcha,
    progressiveDelay,
    logSecurityEvent,
    blockIP
};
