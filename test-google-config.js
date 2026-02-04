const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('\n🔍 Google OAuth Configuration Test\n');
console.log('='.repeat(50));

// Test 1: Check Environment Variables
console.log('\n📋 Environment Variables Check:');
console.log('-'.repeat(50));

const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'JWT_SECRET'
];

let allConfigured = true;

requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value !== 'your_value_here') {
        console.log(`✅ ${varName}: Configured`);
    } else {
        console.log(`❌ ${varName}: NOT SET or using placeholder`);
        allConfigured = false;
    }
});

// Test 2: Validate Google Client ID format
console.log('\n🔐 Google Client ID Validation:');
console.log('-'.repeat(50));

const clientId = process.env.GOOGLE_CLIENT_ID;
if (clientId && clientId.endsWith('.apps.googleusercontent.com')) {
    console.log('✅ Google Client ID format is valid');
} else {
    console.log('❌ Google Client ID format is invalid');
    allConfigured = false;
}

// Test 3: Check if google-auth-library is installed
console.log('\n📦 Dependencies Check:');
console.log('-'.repeat(50));

try {
    require('google-auth-library');
    console.log('✅ google-auth-library is installed');
} catch (e) {
    console.log('❌ google-auth-library is NOT installed');
    allConfigured = false;
}

try {
    require('jsonwebtoken');
    console.log('✅ jsonwebtoken is installed');
} catch (e) {
    console.log('❌ jsonwebtoken is NOT installed');
    allConfigured = false;
}

try {
    require('cookie-parser');
    console.log('✅ cookie-parser is installed');
} catch (e) {
    console.log('❌ cookie-parser is NOT installed');
    allConfigured = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allConfigured) {
    console.log('✅ All backend configurations are correct!');
    console.log('\n📝 Next Steps:');
    console.log('1. Start backend: npm start');
    console.log('2. Start frontend: npm run dev (in root directory)');
    console.log('3. Navigate to http://localhost:5173/login');
    console.log('4. Click "Continue with Google" button');
    console.log('5. Verify login works correctly');
} else {
    console.log('❌ Some configurations are missing or incorrect');
    console.log('Please check your .env file');
}
console.log('='.repeat(50) + '\n');
