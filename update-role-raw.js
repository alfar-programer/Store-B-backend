const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

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

const TARGET_EMAIL = 'mazenaboelelaelfar@admin.com';

async function forceUpdateRole() {
    let connection;
    try {
        console.log('🔄 Connecting to database...');
        console.log(`   Host: ${DB_CONFIG.host}`);
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected.');

        // 1. Check current status
        console.log(`🔍 Checking user: ${TARGET_EMAIL}`);
        const [users] = await connection.query('SELECT id, email, role FROM Users WHERE email = ?', [TARGET_EMAIL]);

        if (users.length === 0) {
            console.error(`❌ User ${TARGET_EMAIL} not found!`);
            // Check if ANY users exist
            const [allUsers] = await connection.query('SELECT email FROM Users LIMIT 5');
            console.log('Sample users found:', allUsers.map(u => u.email));
            process.exit(1);
        }

        const user = users[0];
        console.log(`ℹ️  Current status: ${user.email} is [${user.role}]`);

        // 2. Update to admin if needed
        if (user.role !== 'admin') {
            console.log('🔄 Updating role to ADMIN...');
            await connection.query('UPDATE Users SET role = ? WHERE email = ?', ['admin', TARGET_EMAIL]);
            console.log('✅ Role updated successfully.');

            // Verify
            const [updated] = await connection.query('SELECT role FROM Users WHERE email = ?', [TARGET_EMAIL]);
            console.log(`✨ New role: ${updated[0].role}`);
        } else {
            console.log('✅ User is already admin.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

forceUpdateRole();
