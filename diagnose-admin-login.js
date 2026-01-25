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

const TEST_EMAIL = process.env.ADMIN_EMAIL;
const TEST_PASSWORD = process.env.ADMIN_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
    process.exit(1);
}

async function diagnoseAdminLogin() {
    let connection;
    try {
        console.log('🔍 ADMIN LOGIN DIAGNOSTIC TOOL\n');
        console.log('='.repeat(60));
        console.log('Testing admin account:', TEST_EMAIL);
        console.log('='.repeat(60) + '\n');

        // Step 1: Connect to database
        console.log('Step 1: Connecting to database...');
        console.log(`  Host: ${DB_CONFIG.host}`);
        console.log(`  Port: ${DB_CONFIG.port}`);
        console.log(`  Database: ${DB_CONFIG.database}`);
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Database connection successful\n');

        // Step 2: Check if user exists
        console.log('Step 2: Checking if user exists...');
        const [users] = await connection.query(
            'SELECT id, name, email, password, role, createdAt FROM Users WHERE email = ?',
            [TEST_EMAIL]
        );

        if (users.length === 0) {
            console.log('❌ PROBLEM FOUND: User does not exist in database');
            console.log('\n📋 SOLUTION:');
            console.log('   Run the following command to create the admin user:');
            console.log('   node create-admin.js');
            console.log('\n   Make sure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env file');
            process.exit(1);
        }

        const user = users[0];
        console.log('✅ User found in database');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
        console.log('');

        // Step 3: Check role
        console.log('Step 3: Verifying admin role...');
        if (user.role !== 'admin') {
            console.log(`❌ PROBLEM FOUND: User role is "${user.role}" instead of "admin"`);
            console.log('\n📋 SOLUTION:');
            console.log('   Run the following SQL command to fix the role:');
            console.log(`   UPDATE Users SET role = 'admin' WHERE email = '${TEST_EMAIL}';`);
            console.log('\n   Or run: node fix-admin-role.js');
            process.exit(1);
        }
        console.log('✅ User has admin role\n');

        // Step 4: Test password hash
        console.log('Step 4: Testing password verification...');
        console.log(`   Testing password: ${TEST_PASSWORD.substring(0, 5)}***`);

        const isPasswordValid = await bcrypt.compare(TEST_PASSWORD, user.password);

        if (!isPasswordValid) {
            console.log('❌ PROBLEM FOUND: Password does not match the stored hash');
            console.log('\n📋 POSSIBLE CAUSES:');
            console.log('   1. The password in .env file is incorrect');
            console.log('   2. The password was changed after user creation');
            console.log('   3. The password hash in database is corrupted');
            console.log('\n📋 SOLUTION:');
            console.log('   Option 1: Update the password in database');
            console.log('   Run the following to create a new hash:');
            console.log('   node -e "const bcrypt = require(\'bcryptjs\'); bcrypt.hash(\'YOUR_PASSWORD\', 10).then(h => console.log(h));"');
            console.log('\n   Option 2: Delete the user and recreate it');
            console.log(`   DELETE FROM Users WHERE email = '${TEST_EMAIL}';`);
            console.log('   Then run: node create-admin.js');
            process.exit(1);
        }
        console.log('✅ Password verification successful\n');

        // Step 5: Test complete login flow
        console.log('Step 5: Simulating complete login flow...');
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log('✅ JWT token generated successfully');
        console.log(`   Token: ${token.substring(0, 30)}...`);
        console.log('');

        // Final summary
        console.log('='.repeat(60));
        console.log('✅ ALL CHECKS PASSED!');
        console.log('='.repeat(60));
        console.log('\n📊 SUMMARY:');
        console.log('   ✓ Database connection: OK');
        console.log('   ✓ User exists: YES');
        console.log('   ✓ Admin role: CORRECT');
        console.log('   ✓ Password verification: SUCCESSFUL');
        console.log('   ✓ JWT token generation: OK');
        console.log('\n🎯 CONCLUSION:');
        console.log('   The admin account is properly configured in the database.');
        console.log('   If login is still failing, the issue is likely:');
        console.log('   1. Frontend not sending correct credentials');
        console.log('   2. Backend API not accessible from frontend');
        console.log('   3. CORS or network issues');
        console.log('   4. Environment variables mismatch between local and deployed');
        console.log('\n💡 NEXT STEPS:');
        console.log('   1. Check browser console for errors during login');
        console.log('   2. Verify API endpoint URL in frontend code');
        console.log('   3. Check backend logs for login attempts');
        console.log('   4. Verify .env variables are set in deployment environment');
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

diagnoseAdminLogin();
