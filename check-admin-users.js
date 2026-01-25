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

async function checkAdminUsers() {
    let connection;
    try {
        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database\n');

        // Check all users
        const [allUsers] = await connection.query('SELECT id, name, email, role FROM Users');
        console.log('=== ALL USERS ===');
        console.log(`Total users: ${allUsers.length}\n`);

        allUsers.forEach((user, index) => {
            console.log(`User ${index + 1}:`);
            console.log(`  ID: ${user.id}`);
            console.log(`  Name: ${user.name}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Role: ${user.role}`);
            console.log('');
        });

        // Check specifically for admin users
        const [adminUsers] = await connection.query('SELECT id, name, email FROM Users WHERE role = ?', ['admin']);
        console.log('\n=== ADMIN USERS ===');
        console.log(`Total admin users: ${adminUsers.length}\n`);

        if (adminUsers.length === 0) {
            console.log('⚠️  WARNING: No admin users found in the database!');
            console.log('ℹ️  You need to create an admin user to access the dashboard.');
            console.log('ℹ️  Run the create-admin.js script with ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
        } else {
            adminUsers.forEach((admin, index) => {
                console.log(`Admin ${index + 1}:`);
                console.log(`  ID: ${admin.id}`);
                console.log(`  Name: ${admin.name}`);
                console.log(`  Email: ${admin.email}`);
                console.log('');
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking admin users:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkAdminUsers();
