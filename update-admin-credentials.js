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

async function updateAdminCredentials() {
    let connection;
    try {
        const newAdminEmail = process.env.ADMIN_EMAIL;
        const newAdminPassword = process.env.ADMIN_PASSWORD;

        if (!newAdminEmail || !newAdminPassword) {
            console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.');
            process.exit(1);
        }

        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database\n');

        // Find existing admin user
        const [admins] = await connection.query(
            'SELECT id, email FROM Users WHERE role = ?',
            ['admin']
        );

        if (admins.length === 0) {
            console.log('❌ No admin user found. Creating new admin...');
            const hashedPassword = await bcrypt.hash(newAdminPassword, 10);
            await connection.query(
                'INSERT INTO Users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
                ['Admin User', newAdminEmail, hashedPassword, 'admin', '1234567890']
            );
            console.log('✅ New admin user created!');
            console.log(`📧 Email: ${newAdminEmail}`);
        } else {
            const adminId = admins[0].id;
            const currentEmail = admins[0].email;

            console.log(`📋 Current admin email: ${currentEmail}`);
            console.log(`📋 New admin email: ${newAdminEmail}\n`);

            // Hash new password
            const hashedPassword = await bcrypt.hash(newAdminPassword, 10);

            // Update admin credentials
            await connection.query(
                'UPDATE Users SET email = ?, password = ? WHERE id = ?',
                [newAdminEmail, hashedPassword, adminId]
            );

            console.log('✅ Admin credentials updated successfully!');
            console.log(`📧 New email: ${newAdminEmail}`);
            console.log('🔑 Password has been updated');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating admin credentials:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

updateAdminCredentials();
