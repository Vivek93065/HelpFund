/**
 * scripts/test-db.js
 * 
 * Milestone 1 Isolated In-Memory Database Verification Test Suite
 * 
 * Architecture & Safety:
 * - Runs 100% in RAM using SQLite ':memory:' mode.
 * - Zero disk reads or writes to the main 'helpfund.db' file.
 * - Reuses the exact production schema definition from src/config/db.js via initDatabase(testDb).
 * - Tests table presence, foreign key constraints, and transactional rollback.
 */

const Database = require('better-sqlite3');
const { initDatabase } = require('../src/config/db');

console.log('====================================================');
console.log('  HelpFund Milestone 1: In-Memory DB Verification   ');
console.log('====================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`PASS: ${description}`);
    testsPassed++;
  } else {
    console.error(`FAIL: ${description}`);
    testsFailed++;
  }
}

let testDb;

try {
  // Step 1: Create an isolated in-memory SQLite database
  console.log('[Setup] Initializing isolated in-memory SQLite database (:memory:)...');
  testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  testDb.pragma('synchronous = NORMAL');

  // Step 2: Apply the production schema onto the in-memory database
  initDatabase(testDb);
  console.log('[Setup] Schema successfully applied to in-memory instance.\n');

  // Test 1: Verify all 4 required tables exist in the in-memory schema
  const requiredTables = ['users', 'campaigns', 'donations', 'campaign_updates'];
  const existingTables = testDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  requiredTables.forEach((table) => {
    assert(existingTables.includes(table), `Table '${table}' exists in schema`);
  });

  // Test 2: Verify Foreign Key enforcement is active (1)
  const foreignKeys = testDb.pragma('foreign_keys', { simple: true });
  assert(foreignKeys === 1, 'PRAGMA foreign_keys is enabled (1)');

  // Test 3: Verify Foreign Key constraint rejects orphan records (ACID integrity)
  let fkErrorCaught = false;
  try {
    // Attempt inserting a campaign with a non-existent user_id (999999)
    testDb.prepare(`
      INSERT INTO campaigns (user_id, title, category, short_description, story_content, target_amount, deadline)
      VALUES (999999, 'Test Campaign', 'Medical', 'Short description', 'Story text', 1000, '2027-01-01')
    `).run();
  } catch (err) {
    if (err.message.includes('FOREIGN KEY')) {
      fkErrorCaught = true;
    }
  }
  assert(fkErrorCaught, 'Foreign key constraint correctly blocks orphan records');

  // Test 4: Verify Valid Relational Insert (User -> Campaign)
  const userResult = testDb.prepare(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Jane Doe', 'jane@example.com', 'hashed_pass_placeholder', 'creator');

  const campaignResult = testDb.prepare(`
    INSERT INTO campaigns (user_id, title, category, short_description, story_content, target_amount, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userResult.lastInsertRowid, 'Valid Campaign', 'Education', 'Short desc', 'Story content', 5000, '2027-06-01');

  assert(campaignResult.lastInsertRowid > 0, 'Relational insert succeeds when valid foreign key user_id is provided');

  // Test 5: Verify Transaction Atomicity & Rollback
  const testTransaction = testDb.transaction(() => {
    testDb.prepare(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Rollback User', 'rollback@example.com', 'hash', 'donor');

    // Intentionally throw to trigger atomic rollback
    throw new Error('ROLLBACK_INTENTIONAL');
  });

  try {
    testTransaction();
  } catch (err) {
    if (err.message === 'ROLLBACK_INTENTIONAL') {
      const checkUser = testDb.prepare("SELECT * FROM users WHERE email = 'rollback@example.com'").get();
      assert(!checkUser, 'Atomic transaction rollback cleans up uncommitted operations');
    } else {
      throw err;
    }
  }

  console.log('\n====================================================');
  console.log(`Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  if (testsFailed === 0) {
    console.log('✓ All Milestone 1 In-Memory Database tests PASSED!');
  } else {
    console.error('❌ Some checks failed.');
    process.exit(1);
  }
  console.log('====================================================\n');
} catch (error) {
  console.error('\n❌ Unexpected error during testing:', error.message);
  process.exit(1);
} finally {
  if (testDb) {
    testDb.close();
    console.log('[Cleanup] In-memory database closed cleanly. Zero persistent disk changes.');
  }
}
