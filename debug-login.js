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

const email = process.env.ADMIN_EMAIL || "mazenaboelelaelfar@admin.com";
const password = process.env.ADMIN_PASSWORD || "Mazen198165967#";

async function checkAdmin() {
    console.log('Connecting to DB...', DB_CONFIG.host);
    const connection = await mysql.createConnection(DB_CONFIG);

    try {
        console.log(`Checking for user: ${email}`);
        const [users] = await connection.query('SELECT * FROM Users WHERE email = ?', [email]);

        if (users.length === 0) {
            console.log('❌ User NOT found in database.');

            // Check if ANY users exist
            const [allUsers] = await connection.query('SELECT count(*) as count FROM Users');
            console.log(`Total users in DB: ${allUsers[0].count}`);

        } else {
            const user = users[0];
            console.log('✅ User found:', { id: user.id, email: user.email, role: user.role });

            console.log('Verifying password...');
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                console.log('✅ Password MATCHES!');
            } else {
                console.log('❌ Password does NOT match.');
                console.log('Stored Hash:', user.password);
                console.log('Input Password:', password);

                // Generate a new hash for the password to see what it should look like
                const newHash = await bcrypt.hash(password, 12);
                console.log('Expected Hash (generated now):', newHash);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

checkAdmin();
