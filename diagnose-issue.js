const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const DB_CONFIG = {
    host: process.env.DB_HOST || 'mysql-73b2b04-mazenalfar01.h.aivencloud.com',
    port: Number(process.env.DB_PORT || 23199),
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    ssl: { rejectUnauthorized: false }
};

async function diagnose() {
    console.log('🔍 Starting Diagnosis...');

    try {
        const connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to Database');

        // Check Users table columns
        const [columns] = await connection.query('SHOW COLUMNS FROM Users');
        const columnNames = columns.map(c => c.Field);
        console.log('📋 User Columns:', columnNames.join(', '));

        if (columnNames.includes('isBlocked')) {
            console.log('✅ isBlocked column EXISTS');
        } else {
            console.error('❌ isBlocked column MISSING');
        }

        // Check Orders table
        const [orderColumns] = await connection.query('SHOW COLUMNS FROM Orders');
        const orderColumnNames = orderColumns.map(c => c.Field);
        console.log('📋 Order Columns:', orderColumnNames.join(', '));

        // Check recently modified users
        const [users] = await connection.query('SELECT id, email, role, isVerified, isBlocked FROM Users ORDER BY updatedAt DESC LIMIT 5');
        console.log('👥 Recent Users Status:');
        users.forEach(u => {
            console.log(`ID: ${u.id}, Email: ${u.email}, Blocked: ${u.isBlocked}, Role: ${u.role}`);
        });

        await connection.end();
    } catch (error) {
        console.error('❌ Database Connection Error:', error.message);
    }
}

diagnose();
