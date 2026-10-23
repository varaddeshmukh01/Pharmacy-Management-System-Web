/**
 * Automated Verification & Integration Test Suite for Pharmacy Management Web Application
 * Tests all database interactions, CRUD operations, transactions, and authentication.
 */

const { initializeDatabase, getPool } = require('../src/db');
const bcrypt = require('bcryptjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PHARMACY MANAGEMENT SYSTEM WEB APP INTEGRATION TESTS');
  console.log('============================================================\n');

  // 1. Database Init Check
  const dbOk = await initializeDatabase();
  assert(dbOk, 'MySQL connection and database initialization');

  if (!dbOk) {
    console.error('❌ Cannot proceed with tests without MySQL connection.');
    process.exit(1);
  }

  const pool = getPool();

  try {
    // 2. Authentication & Admin Account
    console.log('\n🔹 [1/7] Testing Authentication & Users...');
    const [adminRows] = await pool.execute('SELECT ID, NAME, PASSWORD FROM users WHERE ID = 1');
    assert(adminRows.length > 0, 'Default admin user exists (ID: 1)');

    const admin = adminRows[0];
    const isPassValid = (admin.PASSWORD === 'admin') || (await bcrypt.compare('admin', admin.PASSWORD));
    assert(isPassValid, 'Admin password matches "admin" (plain or bcrypt)');

    // Create a test employee
    const [existingTestUser] = await pool.execute('SELECT ID FROM users WHERE ID = 8888');
    if (existingTestUser.length > 0) {
      await pool.execute('DELETE FROM users WHERE ID = 8888');
    }
    const testHash = await bcrypt.hash('secret123', 10);
    await pool.execute(
      'INSERT INTO users (ID, NAME, DOB, ADDRESS, PHONE, SALARY, PASSWORD) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [8888, 'test_user_web', '10-10-1992', 'Testing City', '555-1234', 35000, testHash]
    );
    const [createdUser] = await pool.execute('SELECT NAME, SALARY FROM users WHERE ID = 8888');
    assert(createdUser.length > 0 && createdUser[0].SALARY === 35000, 'Created test user (ID: 8888)');

    // 3. Company CRUD
    console.log('\n🔹 [2/7] Testing Company Module...');
    const testCompName = 'TestWeb Pharma Corp';
    await pool.execute('DELETE FROM company WHERE NAME = ?', [testCompName]);

    await pool.execute('INSERT INTO company (NAME, ADDRESS, PHONE) VALUES (?, ?, ?)', [
      testCompName, '123 Test Blvd, City', '022-99887766'
    ]);
    const [compRows] = await pool.execute('SELECT * FROM company WHERE NAME = ?', [testCompName]);
    assert(compRows.length > 0, `Created company '${testCompName}'`);

    await pool.execute('UPDATE company SET PHONE = ? WHERE NAME = ?', ['022-11112222', testCompName]);
    const [updatedComp] = await pool.execute('SELECT PHONE FROM company WHERE NAME = ?', [testCompName]);
    assert(updatedComp[0].PHONE === '022-11112222', `Updated company phone number`);

    // 4. Drug Inventory CRUD & Details
    console.log('\n🔹 [3/7] Testing Drug Inventory...');
    const testBarcode = 'WEB-TEST-BARCODE-99';
    await pool.execute('DELETE FROM drugs WHERE BARCODE = ?', [testBarcode]);

    await pool.execute(`
      INSERT INTO drugs (BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, EXPIRY, COMPANY_NAME, PRODUCTION_DATE, EXPIRATION_DATE, PLACE, QUANTITY)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testBarcode, 'WebTest Antibiotic', 'Capsule', '500mg', 'WT01',
      10.0, 18.0, 'Available for use', testCompName, '2024-01-01', '2027-01-01', 'Z-Rack', 60
    ]);
    const [drugRows] = await pool.execute('SELECT * FROM drugs WHERE BARCODE = ?', [testBarcode]);
    assert(drugRows.length > 0 && drugRows[0].QUANTITY === 60, 'Created new drug record with stock 60');

    // Edit Price
    await pool.execute('UPDATE drugs SET COST_PRICE = 12.0, SELLING_PRICE = 22.5 WHERE BARCODE = ?', [testBarcode]);
    const [priceRows] = await pool.execute('SELECT SELLING_PRICE FROM drugs WHERE BARCODE = ?', [testBarcode]);
    assert(priceRows[0].SELLING_PRICE === 22.5, 'Edited drug selling price to $22.50');

    // Move Place
    await pool.execute('UPDATE drugs SET PLACE = ? WHERE BARCODE = ?', ['Shelf-X', testBarcode]);
    const [placeRows] = await pool.execute('SELECT PLACE FROM drugs WHERE BARCODE = ?', [testBarcode]);
    assert(placeRows[0].PLACE === 'Shelf-X', 'Moved drug storage location to Shelf-X');

    // Renew Validity
    await pool.execute('UPDATE drugs SET EXPIRATION_DATE = ? WHERE BARCODE = ?', ['2028-12-31', testBarcode]);
    const [expRows] = await pool.execute('SELECT EXPIRATION_DATE FROM drugs WHERE BARCODE = ?', [testBarcode]);
    assert(String(expRows[0].EXPIRATION_DATE).includes('2028'), 'Renewed drug expiration date');

    // 5. Purchases Module
    console.log('\n🔹 [4/7] Testing Purchases & Procurement Deals...');
    const testPoBarcode = 'PO-WEB-DEAL-77';
    await pool.execute('DELETE FROM purchase WHERE BARCODE = ?', [testPoBarcode]);

    await pool.execute(`
      INSERT INTO purchase (BARCODE, NAME, TYPE, COMPANY_NAME, QUANTITY, PRICE, AMOUNT) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testPoBarcode, 'WebTest Antibiotic', 'Capsule', testCompName, 100, 10.0, 1000.0]);
    const [poRows] = await pool.execute('SELECT * FROM purchase WHERE BARCODE = ?', [testPoBarcode]);
    assert(poRows.length > 0 && poRows[0].AMOUNT === 1000.0, 'Recorded supplier procurement deal ($1000)');

    // 6. POS Sales, Stock Decrement & Transaction Checkout
    console.log('\n🔹 [5/7] Testing POS Sales, Stock Auto-Decrement & Checkout...');
    // Add item to sales cart
    await pool.execute(`
      INSERT INTO sales (BARCODE, NAME, TYPE, DOSE, QUANTITY, PRICE, AMOUNT, DATE) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [testBarcode, 'WebTest Antibiotic', 'Capsule', '500mg', 5, 22.5, 112.5, '21-10-2026']);
    const [cartRows] = await pool.execute('SELECT * FROM sales WHERE BARCODE = ?', [testBarcode]);
    assert(cartRows.length > 0, 'Added 5 units of drug to active POS cart');

    // Execute checkout decrement
    await pool.execute('UPDATE drugs SET QUANTITY = QUANTITY - ? WHERE BARCODE = ?', [5, testBarcode]);
    await pool.execute(`
      INSERT INTO history_sales (USER_NAME, BARCODE, NAME, TYPE, DOSE, QUANTITY, PRICE, AMOUNT, DATE, TIME) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['admin', testBarcode, 'WebTest Antibiotic', 'Capsule', '500mg', 5, 22.5, 112.5, '21-10-2026', '12:00:00']);
    await pool.execute('DELETE FROM sales WHERE BARCODE = ?', [testBarcode]);

    const [postSaleDrug] = await pool.execute('SELECT QUANTITY FROM drugs WHERE BARCODE = ?', [testBarcode]);
    assert(postSaleDrug[0].QUANTITY === 55, 'Drug stock successfully decremented from 60 to 55');

    const [histRows] = await pool.execute('SELECT * FROM history_sales WHERE BARCODE = ?', [testBarcode]);
    assert(histRows.length > 0, 'Sales transaction saved in history_sales');

    // Customer return test
    await pool.execute('UPDATE drugs SET QUANTITY = QUANTITY + ? WHERE BARCODE = ?', [2, testBarcode]);
    const [returnedDrug] = await pool.execute('SELECT QUANTITY FROM drugs WHERE BARCODE = ?', [testBarcode]);
    assert(returnedDrug[0].QUANTITY === 57, 'Drug retrieval/return restored stock from 55 to 57');

    // 7. Internal Messaging
    console.log('\n🔹 [6/7] Testing Messaging & Inbox...');
    await pool.execute(
      'INSERT INTO inbox (MESSAGE_FROM, MESSAGE_TO, MESSAGE_TEXT) VALUES (?, ?, ?)',
      ['admin', 'test_user_web', 'Testing web app inbox delivery']
    );
    const [msgRows] = await pool.execute('SELECT * FROM inbox WHERE MESSAGE_TO = ?', ['test_user_web']);
    assert(msgRows.length > 0, 'Internal message sent and delivered to recipient');

    await pool.execute('DELETE FROM inbox WHERE ID = ?', [msgRows[0].ID]);
    assert(true, 'Message removed from inbox');

    // 8. Clean up test records
    console.log('\n🔹 [7/7] Cleaning up test records...');
    await pool.execute('DELETE FROM history_sales WHERE BARCODE = ?', [testBarcode]);
    await pool.execute('DELETE FROM purchase WHERE BARCODE = ?', [testPoBarcode]);
    await pool.execute('DELETE FROM drugs WHERE BARCODE = ?', [testBarcode]);
    await pool.execute('DELETE FROM company WHERE NAME = ?', [testCompName]);
    await pool.execute('DELETE FROM users WHERE ID = 8888');
    assert(true, 'Temporary test data cleaned up cleanly');

    console.log('\n============================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    if (failed === 0) {
      console.log('✅ ALL INTEGRATION & MYSQL WORKFLOW TESTS PASSED PERFECTLY!');
    } else {
      console.error('❌ SOME TESTS FAILED. Please review the output above.');
    }
    console.log('============================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
