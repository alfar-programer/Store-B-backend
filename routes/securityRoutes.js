const express = require('express');
const router = express.Router();

/* ======================
   IP MANAGEMENT
====================== */

// Block an IP address
router.post('/block-ip', async (req, res) => {
    try {
        const { ip, reason, durationMinutes, blockedBy = 'admin' } = req.body;

        if (!ip) {
            return res.status(400).json({
                success: false,
                message: 'IP address is required'
            });
        }

        const duration = durationMinutes || parseInt(process.env.AUTO_UNBLOCK_DURATION || 15);
        const blockedUntil = new Date(Date.now() + duration * 60 * 1000);

        // Check if IP is already blocked
        const [existing] = await req.pool.query('SELECT * FROM blocked_ips WHERE ip = ?', [ip]);

        if (existing.length > 0) {
            // Update existing block
            await req.pool.query(
                `UPDATE blocked_ips 
         SET blocked_until = ?, block_count = block_count + 1, updated_at = NOW(), reason = ?, blocked_by = ?
         WHERE ip = ?`,
                [blockedUntil, reason || 'manual_block', blockedBy, ip]
            );
        } else {
            // Create new block
            await req.pool.query(
                `INSERT INTO blocked_ips 
         (ip, reason, blocked_until, auto_unblock, block_count, blocked_by, created_at, updated_at) 
         VALUES (?, ?, ?, TRUE, 1, ?, NOW(), NOW())`,
                [ip, reason || 'manual_block', blockedUntil, blockedBy]
            );
        }

        // Log the block event
        await req.pool.query(
            `INSERT INTO security_events 
       (ip, event_type, endpoint, user_id, success, metadata, timestamp) 
       VALUES (?, 'ip_blocked', '/admin/security/block-ip', ?, TRUE, ?, NOW())`,
            [ip, req.user?.id, JSON.stringify({ reason, duration, blockedBy })]
        );

        res.json({
            success: true,
            message: `IP ${ip} blocked for ${duration} minutes`,
            blockedUntil
        });
    } catch (error) {
        console.error('Block IP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to block IP',
            error: error.message
        });
    }
});

// Unblock an IP address
router.delete('/unblock-ip', async (req, res) => {
    try {
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({
                success: false,
                message: 'IP address is required'
            });
        }

        const [result] = await req.pool.query('DELETE FROM blocked_ips WHERE ip = ?', [ip]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'IP not found in blocklist'
            });
        }

        res.json({
            success: true,
            message: `IP ${ip} unblocked successfully`
        });
    } catch (error) {
        console.error('Unblock IP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unblock IP',
            error: error.message
        });
    }
});

// Get all blocked IPs
router.get('/blocked-ips', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const [blocked] = await req.pool.query(
            `SELECT * FROM blocked_ips 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [countResult] = await req.pool.query('SELECT COUNT(*) as total FROM blocked_ips');
        const total = countResult[0].total;

        res.json({
            success: true,
            data: blocked,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get blocked IPs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve blocked IPs',
            error: error.message
        });
    }
});

// Add IP to whitelist
router.post('/whitelist-ip', async (req, res) => {
    try {
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({
                success: false,
                message: 'IP address is required'
            });
        }

        // Get current whitelist
        const currentWhitelist = (process.env.IP_WHITELIST || '127.0.0.1,::1').split(',').map(i => i.trim());

        if (currentWhitelist.includes(ip)) {
            return res.status(400).json({
                success: false,
                message: 'IP already in whitelist'
            });
        }

        // Note: This adds to runtime whitelist only
        // For permanent whitelist, admin needs to update .env file
        currentWhitelist.push(ip);
        process.env.IP_WHITELIST = currentWhitelist.join(',');

        res.json({
            success: true,
            message: `IP ${ip} added to whitelist (runtime only - update .env for persistence)`,
            whitelist: currentWhitelist
        });
    } catch (error) {
        console.error('Whitelist IP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to whitelist IP',
            error: error.message
        });
    }
});

// Get whitelist
router.get('/whitelist', async (req, res) => {
    try {
        const whitelist = (process.env.IP_WHITELIST || '127.0.0.1,::1').split(',').map(i => i.trim());

        res.json({
            success: true,
            data: whitelist
        });
    } catch (error) {
        console.error('Get whitelist error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve whitelist',
            error: error.message
        });
    }
});

/* ======================
   SECURITY EVENTS
====================== */

// Get security events with filters
router.get('/events', async (req, res) => {
    try {
        const {
            ip,
            event_type,
            start_date,
            end_date,
            user_id,
            email,
            success,
            page = 1,
            limit = 50
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let query = 'SELECT * FROM security_events WHERE 1=1';
        const params = [];

        // Apply filters
        if (ip) {
            query += ' AND ip = ?';
            params.push(ip);
        }

        if (event_type) {
            query += ' AND event_type = ?';
            params.push(event_type);
        }

        if (start_date) {
            query += ' AND timestamp >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND timestamp <= ?';
            params.push(end_date);
        }

        if (user_id) {
            query += ' AND user_id = ?';
            params.push(user_id);
        }

        if (email) {
            query += ' AND email LIKE ?';
            params.push(`%${email}%`);
        }

        if (success !== undefined) {
            query += ' AND success = ?';
            params.push(success === 'true' ? 1 : 0);
        }

        // Add ordering and pagination
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [events] = await req.pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM security_events WHERE 1=1';
        const countParams = params.slice(0, -2); // Remove limit and offset

        if (ip) countQuery += ' AND ip = ?';
        if (event_type) countQuery += ' AND event_type = ?';
        if (start_date) countQuery += ' AND timestamp >= ?';
        if (end_date) countQuery += ' AND timestamp <= ?';
        if (user_id) countQuery += ' AND user_id = ?';
        if (email) countQuery += ' AND email LIKE ?';
        if (success !== undefined) countQuery += ' AND success = ?';

        const [countResult] = await req.pool.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            data: events,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get security events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve security events',
            error: error.message
        });
    }
});

/* ======================
   DASHBOARD METRICS
====================== */

// Get dashboard metrics
router.get('/dashboard', async (req, res) => {
    try {
        // Active blocked IPs
        const [blockedCount] = await req.pool.query(
            'SELECT COUNT(*) as count FROM blocked_ips WHERE blocked_until > NOW() OR auto_unblock = FALSE'
        );

        // Failed attempts in last hour
        const [failedLast1Hour] = await req.pool.query(
            `SELECT COUNT(*) as count FROM security_events 
       WHERE event_type IN ('login_failed', 'rate_limit_exceeded', 'captcha_failed') 
       AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
        );

        // Failed attempts in last 24 hours
        const [failedLast24Hours] = await req.pool.query(
            `SELECT COUNT(*) as count FROM security_events 
       WHERE event_type IN ('login_failed', 'rate_limit_exceeded', 'captcha_failed') 
       AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );

        // Top attacking IPs
        const [topAttackingIPs] = await req.pool.query(
            `SELECT ip, COUNT(*) as attempts, MAX(timestamp) as lastAttempt 
       FROM security_events 
       WHERE event_type IN ('login_failed', 'rate_limit_exceeded') 
       AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY ip 
       ORDER BY attempts DESC 
       LIMIT 10`
        );

        // Recent events
        const [recentEvents] = await req.pool.query(
            'SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 10'
        );

        // CAPTCHA stats
        const [captchaStats] = await req.pool.query(
            `SELECT 
        COUNT(*) as totalVerifications,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as succeeded
       FROM security_events 
       WHERE event_type = 'captcha_failed' 
       AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );

        const captchaData = captchaStats[0];
        const successRate = captchaData.totalVerifications > 0
            ? ((captchaData.succeeded / captchaData.totalVerifications) * 100).toFixed(2)
            : 0;

        res.json({
            success: true,
            data: {
                activeBlockedIPs: blockedCount[0].count,
                failedAttemptsLast1Hour: failedLast1Hour[0].count,
                failedAttemptsLast24Hours: failedLast24Hours[0].count,
                topAttackingIPs,
                recentEvents,
                captchaStats: {
                    totalVerifications: captchaData.totalVerifications,
                    failed: captchaData.failed,
                    succeeded: captchaData.succeeded,
                    successRate: parseFloat(successRate)
                }
            }
        });
    } catch (error) {
        console.error('Get dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard metrics',
            error: error.message
        });
    }
});

/* ======================
   REPORTS
====================== */

// Generate security report
router.post('/reports/generate', async (req, res) => {
    try {
        const { start_date, end_date, format = 'json' } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        // Get all events in date range
        const [events] = await req.pool.query(
            `SELECT * FROM security_events 
       WHERE timestamp >= ? AND timestamp <= ? 
       ORDER BY timestamp DESC`,
            [start_date, end_date]
        );

        // Get summary statistics
        const [stats] = await req.pool.query(
            `SELECT 
        event_type,
        COUNT(*) as count,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed
       FROM security_events 
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY event_type`,
            [start_date, end_date]
        );

        const report = {
            period: {
                start: start_date,
                end: end_date
            },
            summary: {
                totalEvents: events.length,
                byType: stats
            },
            events: format === 'full' ? events : events.slice(0, 100) // Limit for JSON
        };

        if (format === 'csv') {
            // Convert to CSV
            const csv = convertToCSV(events);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=security-report-${Date.now()}.csv`);
            return res.send(csv);
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
});

// Helper function to convert events to CSV
function convertToCSV(events) {
    if (events.length === 0) return '';

    const headers = Object.keys(events[0]).join(',');
    const rows = events.map(event => {
        return Object.values(event).map(value => {
            // Escape commas and quotes in values
            if (typeof value === 'string') {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    });

    return [headers, ...rows].join('\n');
}

module.exports = router;
