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
        rejectUnauthorized: false, // Required for Aiven
    },
};

async function updateSchema() {
    console.log('🔄 Connecting to database...');
    const pool = mysql.createPool(DB_CONFIG);
    const connection = await pool.getConnection();

    try {
        console.log('📝 Modifying Categories table schema...');

        await connection.query(`
      ALTER TABLE Categories 
      MODIFY COLUMN image TEXT
    `);

        console.log('✅ Successfully updated Categories table: image column is now TEXT');

    } catch (error) {
        console.error('❌ Schema update failed:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

updateSchema();
