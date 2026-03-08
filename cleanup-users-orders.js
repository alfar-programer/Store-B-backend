const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const DB_CONFIG = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false,
    },
};

async function cleanupDatabase() {
    let connection;
    try {
        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database');

        // 1. Delete all orders
        console.log('🔄 Deleting all orders...');
        const [orderResult] = await connection.query('DELETE FROM Orders');
        console.log(`✅ Deleted ${orderResult.affectedRows} orders.`);

        // 2. Delete all email verifications
        console.log('🔄 Deleting all email verifications...');
        const [verificationResult] = await connection.query('DELETE FROM EmailVerifications');
        console.log(`✅ Deleted ${verificationResult.affectedRows} email verifications.`);

        // 3. Delete all security events
        console.log('🔄 Deleting all security events...');
        const [securityResult] = await connection.query('DELETE FROM security_events');
        console.log(`✅ Deleted ${securityResult.affectedRows} security events.`);

        // 4. Delete all blocked IPs
        console.log('🔄 Deleting all blocked IPs...');
        const [blockedResult] = await connection.query('DELETE FROM blocked_ips');
        console.log(`✅ Deleted ${blockedResult.affectedRows} blocked IPs.`);

        // 5. Delete non-admin users
        console.log('🔄 Deleting non-admin users...');
        const [userResult] = await connection.query("DELETE FROM Users WHERE role != 'admin'");
        console.log(`✅ Deleted ${userResult.affectedRows} non-admin users.`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed.');
        }
    }
}

cleanupDatabase();
