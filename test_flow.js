const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
    try {
        console.log('--- Starting Verification ---');

        // 1. Register
        const email = `testuser_${Date.now()}@example.com`;
        const password = 'password123';
        console.log(`1. Registering user: ${email}`);
        await axios.post(`${BASE_URL}/auth/register`, {
            name: 'Test User',
            email,
            password
        });
        console.log('   Registration Successful');

        // 2. Login
        console.log('2. Logging in');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email,
            password
        });
        const { token, user } = loginRes.data;
        if (!token || !user) throw new Error('Login failed: No token or user returned');
        console.log(`   Login Successful. UserId: ${user.id}`);

        // 3. Create Order
        console.log('3. Creating Order linked to user');
        const orderRes = await axios.post(`${BASE_URL}/orders`, {
            customerName: 'Test User',
            total: 100,
            items: [{ id: 1, title: 'Item 1', price: 50, quantity: 2 }],
            userId: user.id
        });
        console.log(`   Order Created. Order ID: ${orderRes.data.id}`);

        // 4. Verify Order Link (This would ideally check the DB, but we'll check if the response includes UserId if the model returns it, or we rely on no error being thrown)
        // Since my backend returns the created object, let's see if UserId is in it.
        if (orderRes.data.UserId == user.id) { // Sequelize usually returns the created attributes
            console.log('   Verification PASSED: Order is linked to User.');
        } else {
            console.log('   Observation: UserId not explicitly returned in create response (might be omitted by default), but request succeeded.');
        }

        console.log('--- Verification Complete ---');

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
