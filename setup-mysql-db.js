require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;

    try {
        const connection = await mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASS,
        });

        console.log(`Connected to MySQL server at ${DB_HOST}`);

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
        console.log(`Database '${DB_NAME}' created or already exists.`);

        await connection.end();
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    }
}

setupDatabase();
