const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'mysql-73b2b04-mazenalfar01.h.aivencloud.com',
    port: Number(process.env.DB_PORT || 23199),
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    ssl: {
        rejectUnauthorized: false,
    },
};

async function addImageColumnToCategories() {
    let connection;
    try {
        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database');

        // Check if the column already exists
        const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'Categories' 
      AND COLUMN_NAME = 'image'
    `, [DB_CONFIG.database]);

        if (columns.length > 0) {
            console.log('ℹ️  Image column already exists in Categories table');
        } else {
            console.log('🔄 Adding image column to Categories table...');
            await connection.query(`
        ALTER TABLE Categories 
        ADD COLUMN image VARCHAR(255) AFTER description
      `);
            console.log('✅ Image column added successfully');
        }

        console.log('✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

addImageColumnToCategories();
