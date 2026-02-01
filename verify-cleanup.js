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

async function verifyCleanup() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        const [orders] = await connection.query('SELECT COUNT(*) as count FROM Orders');
        const [users] = await connection.query('SELECT COUNT(*) as count FROM Users');
        const [nonAdmin] = await connection.query("SELECT COUNT(*) as count FROM Users WHERE role != 'admin'");
        const [admins] = await connection.query("SELECT email FROM Users WHERE role = 'admin'");

        const orderCount = orders[0].count;
        const nonAdminCount = nonAdmin[0].count;
        const adminCount = users[0].count - nonAdminCount;

        if (orderCount === 0 && nonAdminCount === 0 && adminCount > 0) {
            console.log('VERIFICATION_SUCCESS_CLEAN');
            console.log(`Admins: ${admins.map(a => a.email).join(', ')}`);
        } else {
            console.log('VERIFICATION_FAILURE_DIRTY');
            console.log(`Orders: ${orderCount}, Non-Admins: ${nonAdminCount}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

verifyCleanup();
