require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTable() {
    let pool;
    try {
        console.log("Connecting to database...");
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: {
                rejectUnauthorized: false
            }
        });

        const query = `
            CREATE TABLE IF NOT EXISTS ProductRecommendations (
                sourceProductId INT NOT NULL,
                targetProductId INT NOT NULL,
                score FLOAT DEFAULT 0.0,
                isPinned BOOLEAN DEFAULT FALSE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (sourceProductId, targetProductId),
                FOREIGN KEY (sourceProductId) REFERENCES Products(id) ON DELETE CASCADE,
                FOREIGN KEY (targetProductId) REFERENCES Products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        console.log("Executing query...");
        await pool.query(query);
        console.log("ProductRecommendations table created successfully!");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        if (pool) {
            await pool.end();
            console.log("Pool connection closed.");
        }
    }
}

createTable();
