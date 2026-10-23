const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Determine configuration values with fallback
const host = process.env.DB_HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const database = process.env.DB_NAME || 'pharmacy_db';

let password = process.env.DB_PASSWORD || '';
// If password is placeholder, check config.properties as a smart fallback
if (password === 'your_password_here' || !password) {
  const configPropPath = path.resolve(__dirname, '../../config.properties');
  if (fs.existsSync(configPropPath)) {
    try {
      const content = fs.readFileSync(configPropPath, 'utf8');
      const match = content.match(/^DB_PASSWORD\s*=\s*(.*)$/m);
      if (match && match[1] && match[1].trim() !== 'your_password_here') {
        password = match[1].trim();
      }
    } catch (_) {}
  }
}

// Connection pool reference
let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

/**
 * Initializes database and tables safely if they do not already exist.
 */
async function initializeDatabase() {
  console.log('\n============================================================');
  console.log('🔄 [MySQL] Initializing connection to MySQL server...');
  console.log(`📍 Host: ${host}:${port} | User: ${user} | Target DB: ${database}`);

  let serverConn = null;
  try {
    // 1. Connect without database to ensure database exists
    serverConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      charset: 'utf8mb4'
    });

    await serverConn.execute(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await serverConn.end();
    serverConn = null;

    // 2. Obtain connection pool with target database
    const dbPool = getPool();
    const conn = await dbPool.getConnection();

    // 3. Create tables with IF NOT EXISTS
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`company\` (
        \`NAME\` VARCHAR(50) NOT NULL,
        \`ADDRESS\` VARCHAR(100) NOT NULL,
        \`PHONE\` VARCHAR(20) NOT NULL,
        PRIMARY KEY (\`NAME\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`ID\` INT(11) NOT NULL,
        \`NAME\` VARCHAR(50) NOT NULL UNIQUE,
        \`DOB\` VARCHAR(20) NOT NULL,
        \`ADDRESS\` VARCHAR(100) NOT NULL,
        \`PHONE\` VARCHAR(20) NOT NULL,
        \`SALARY\` DOUBLE NOT NULL,
        \`PASSWORD\` VARCHAR(255) NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure PASSWORD column in users is VARCHAR(255) to accommodate bcrypt
    try {
      await conn.execute(`ALTER TABLE \`users\` MODIFY COLUMN \`PASSWORD\` VARCHAR(255) NOT NULL;`);
    } catch (_) {}

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`drugs\` (
        \`BARCODE\` VARCHAR(50) NOT NULL,
        \`NAME\` VARCHAR(100) NOT NULL,
        \`TYPE\` VARCHAR(30) NOT NULL,
        \`DOSE\` VARCHAR(30) NOT NULL,
        \`CODE\` VARCHAR(30) NOT NULL,
        \`COST_PRICE\` DOUBLE NOT NULL,
        \`SELLING_PRICE\` DOUBLE NOT NULL,
        \`EXPIRY\` VARCHAR(30) NOT NULL DEFAULT 'Available for use',
        \`COMPANY_NAME\` VARCHAR(50) NOT NULL,
        \`PRODUCTION_DATE\` DATE NOT NULL,
        \`EXPIRATION_DATE\` DATE NOT NULL,
        \`PLACE\` VARCHAR(50) NOT NULL,
        \`QUANTITY\` INT(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`BARCODE\`),
        CONSTRAINT \`fk_drugs_company\` FOREIGN KEY (\`COMPANY_NAME\`) 
          REFERENCES \`company\` (\`NAME\`) 
          ON UPDATE CASCADE 
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`purchase\` (
        \`BARCODE\` VARCHAR(50) NOT NULL,
        \`NAME\` VARCHAR(100) NOT NULL,
        \`TYPE\` VARCHAR(30) NOT NULL,
        \`COMPANY_NAME\` VARCHAR(50) NOT NULL,
        \`QUANTITY\` INT(11) NOT NULL,
        \`PRICE\` DOUBLE NOT NULL,
        \`AMOUNT\` DOUBLE NOT NULL,
        PRIMARY KEY (\`BARCODE\`),
        CONSTRAINT \`fk_purchase_company\` FOREIGN KEY (\`COMPANY_NAME\`) 
          REFERENCES \`company\` (\`NAME\`) 
          ON UPDATE CASCADE 
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`sales\` (
        \`ID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`BARCODE\` VARCHAR(50) NOT NULL,
        \`NAME\` VARCHAR(100) NOT NULL,
        \`TYPE\` VARCHAR(30) NOT NULL,
        \`DOSE\` VARCHAR(30) NOT NULL,
        \`QUANTITY\` INT(11) NOT NULL,
        \`PRICE\` DOUBLE NOT NULL,
        \`AMOUNT\` DOUBLE NOT NULL,
        \`DATE\` VARCHAR(20) NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`history_sales\` (
        \`ID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`USER_NAME\` VARCHAR(50) NOT NULL,
        \`BARCODE\` VARCHAR(50) NOT NULL,
        \`NAME\` VARCHAR(100) NOT NULL,
        \`TYPE\` VARCHAR(30) NOT NULL,
        \`DOSE\` VARCHAR(30) NOT NULL,
        \`QUANTITY\` INT(11) NOT NULL,
        \`PRICE\` DOUBLE NOT NULL,
        \`AMOUNT\` DOUBLE NOT NULL,
        \`DATE\` VARCHAR(20) NOT NULL,
        \`TIME\` VARCHAR(20) NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`login\` (
        \`ID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`NAME\` VARCHAR(50) NOT NULL,
        \`TYPE\` VARCHAR(20) NOT NULL,
        \`DATE\` VARCHAR(20) NOT NULL,
        \`TIME\` VARCHAR(20) NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`inbox\` (
        \`ID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`MESSAGE_FROM\` VARCHAR(50) NOT NULL,
        \`MESSAGE_TO\` VARCHAR(50) NOT NULL,
        \`MESSAGE_TEXT\` VARCHAR(500) NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`message_history\` (
        \`ID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`MESSAGE_FROM\` VARCHAR(50) NOT NULL,
        \`MESSAGE_TO\` VARCHAR(50) NOT NULL,
        \`MESSAGE_TEXT\` VARCHAR(500) NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Seed default admin if user table has no admin user (ID 1)
    const [existingUsers] = await conn.execute('SELECT ID, NAME, PASSWORD FROM users WHERE ID = 1');
    if (existingUsers.length === 0) {
      const hashedPass = await bcrypt.hash('admin', 10);
      await conn.execute(
        `INSERT INTO users (ID, NAME, DOB, ADDRESS, PHONE, SALARY, PASSWORD) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 'admin', '23-12-1995', 'Mumbai, India', '9800000000', 50000, hashedPass]
      );
      console.log('✅ [MySQL] Default administrator created: ID=1, Username=admin, Password=admin');
    }

    // Seed sample company if empty
    const [companies] = await conn.execute('SELECT COUNT(*) AS cnt FROM company');
    if (companies[0].cnt === 0) {
      await conn.execute(`INSERT IGNORE INTO company (NAME, ADDRESS, PHONE) VALUES 
        ('Cipla', 'Mumbai, India', '022-24826000'),
        ('Sun Pharma', 'Mysore, India', '01289078443'),
        ('Med_City', 'Nellore, India', '010114367832')
      `);
    }

    conn.release();

    console.log(`✅ [MySQL] Successfully connected to MySQL at ${host}:${port}!`);
    console.log(`✅ [MySQL] Schema '${database}' is active and ready in MySQL Workbench.`);
    console.log('============================================================\n');
    return true;
  } catch (err) {
    console.error('\n❌ ============================================================');
    console.error(`❌ [MySQL] Connection FAILED to ${host}:${port} (Database: ${database})`);
    console.error(`❌ Error Code: ${err.code || 'UNKNOWN'} | Message: ${err.message}`);
    console.error('👉 Please check your .env file:');
    console.error('   1. Ensure MySQL Server is running.');
    console.error('   2. Set DB_PASSWORD=your_actual_password in web-app/.env');
    console.error('   3. In MySQL Workbench, verify that user "root" connects on port 3306.');
    console.error('============================================================\n');
    if (serverConn) {
      try { await serverConn.end(); } catch (_) {}
    }
    return false;
  }
}

/**
 * Maps common MySQL error codes to clear, friendly user messages.
 */
function mapDbError(err) {
  if (!err) return 'An unexpected error occurred.';
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return 'Duplicate entry: A record with this identifier or name already exists.';
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    return 'Foreign key violation: The referenced company or record does not exist in the database.';
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
    return 'Cannot delete record: It is currently referenced by other records (e.g. drugs or purchase orders).';
  }
  if (err.code === 'ECONNREFUSED') {
    return 'Database connection failed: MySQL Server is not reachable at the configured host/port.';
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    return 'Database access denied: Check your DB_USER and DB_PASSWORD in .env.';
  }
  return err.sqlMessage || err.message || 'Database error occurred.';
}

module.exports = {
  getPool,
  initializeDatabase,
  mapDbError
};
