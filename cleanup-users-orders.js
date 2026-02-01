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

        // 2. Delete non-admin users
        // Since there is a foreign key constraint might be on Orders (UserId), creating orders first is good,
        // but removing users also might need to handle other related tables if any.
        // Based on index.js schemas:
        // Orders has FOREIGN KEY (UserId) REFERENCES Users(id) ON DELETE SET NULL
        // So deleting users is safe regarding Orders table (if orders weren't deleted).
        // However, we are deleting orders anyway.

        // Check EmailVerifications table first to avoid any constraint issues or orphaned data?
        // EmailVerifications doesn't seem to have a FK strictly enforced in the create table statement shown in index.js, but good to clean up.
        // Actually, the request is specifically "remove all user with out the admin and orders".

        // Let's also clean up EmailVerifications for the users we are deleting, just to be clean.
        // Or just delete all EmailVerifications since we are deleting users? 
        // The user didn't explicitly ask for this, but it's good practice. 
        // I will stick to the specific request: Users (!= admin) and Orders.

        console.log('🔄 Deleting non-admin users...');
        const [userResult] = await connection.query("DELETE FROM Users WHERE role != 'admin'");
        console.log(`✅ Deleted ${userResult.affectedRows} non-admin users.`);

        // Also cleanup EmailVerifications for cleanliness if they are orphaned?
        // The prompt was "remove all user with out the admin and orders".
        // I'll stick to that.

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
