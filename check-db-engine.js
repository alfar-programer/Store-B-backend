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

async function checkDatabaseEngine() {
    console.log('🔍 Checking Database Engine Configuration...\n');

    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to database\n');

        // Check engine for all tables
        const [tables] = await connection.query(`
      SELECT TABLE_NAME, ENGINE 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [DB_CONFIG.database]);

        console.log('📊 Table Engine Status:');
        console.log('─'.repeat(50));

        let hasMyISAM = false;
        tables.forEach(table => {
            const status = table.ENGINE === 'InnoDB' ? '✅' : '❌';
            console.log(`${status} ${table.TABLE_NAME.padEnd(30)} ${table.ENGINE}`);
            if (table.ENGINE !== 'InnoDB') {
                hasMyISAM = true;
            }
        });

        console.log('─'.repeat(50));

        if (hasMyISAM) {
            console.log('\n⚠️  WARNING: Some tables are not using InnoDB engine!');
            console.log('⚠️  Transactions (ROLLBACK) will NOT work on MyISAM tables.');
            console.log('⚠️  This means users may be created even if email sending fails.\n');
            console.log('💡 To fix this, run the following SQL commands:\n');

            tables.forEach(table => {
                if (table.ENGINE !== 'InnoDB') {
                    console.log(`ALTER TABLE ${table.TABLE_NAME} ENGINE=InnoDB;`);
                }
            });
        } else {
            console.log('\n✅ All tables are using InnoDB engine.');
            console.log('✅ Transaction rollback will work correctly.\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkDatabaseEngine();
