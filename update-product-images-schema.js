const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'mysql-73b2b04-mazenalfar01.h.aivencloud.com',
    port: Number(process.env.DB_PORT || 23199),
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: {
        rejectUnauthorized: false,
    },
};

async function updateSchema() {
    console.log('🔄 Connecting to database...');
    const pool = mysql.createPool(DB_CONFIG);
    const connection = await pool.getConnection();

    try {
        console.log('📝 Modifying Products table schema...');

        // Check if we need to backup strictly or just modify. 
        // MODIFY COLUMN to TEXT preserves data but we should be careful.
        // 'image' was VARCHAR(255). We are changing to TEXT.

        await connection.query(`
      ALTER TABLE Products 
      MODIFY COLUMN image TEXT NOT NULL
    `);

        console.log('✅ Successfully updated Products table: image column is now TEXT');

        // Verify
        const [columns] = await connection.query(`
      SHOW COLUMNS FROM Products LIKE 'image'
    `);
        console.log('Current column definition:', columns[0]);

    } catch (error) {
        console.error('❌ Schema update failed:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

updateSchema();
