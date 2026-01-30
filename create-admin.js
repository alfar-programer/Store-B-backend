const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
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

// Validate DB Config
if (!DB_CONFIG.host || !DB_CONFIG.password) {
    console.warn('⚠️  Warning: DB_HOST or DB_PASSWORD not set. DB connection may fail.');
}

async function createAdminUser() {
    let connection;
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.');
            process.exit(1);
        }

        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database');

        // Check if admin already exists
        const [existing] = await connection.query(
            'SELECT id FROM Users WHERE email = ?',
            [adminEmail]
        );

        if (existing.length > 0) {
            console.log(`ℹ️  Admin user (${adminEmail}) already exists`);
            process.exit(0);
        }

        // Create admin user

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await connection.query(
            'INSERT INTO Users (name, email, password, role, phone, isVerified) VALUES (?, ?, ?, ?, ?, TRUE)',
            ['Admin User', adminEmail, hashedPassword, 'admin', '1234567890']
        );

        console.log('✅ Admin user created successfully!');
        console.log(`📧 Email: ${adminEmail}`);
        // Do not log the password for security
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createAdminUser();
