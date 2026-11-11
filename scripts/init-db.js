/**
 * scripts/init-db.js
 * 
 * Standalone Database Initialization & Migration CLI Script
 * 
 * Usage:
 *   node scripts/init-db.js
 * 
 * What it does:
 * 1. Connects to SQLite using better-sqlite3 via src/config/db.js.
 * 2. Runs table creation DDL statements for users, campaigns, donations, campaign_updates.
 * 3. Builds database performance indexes.
 * 4. Verifies database integrity and outputs list of created tables.
 */

const { initDatabase, db, resolvedDbPath } = require('../src/config/db');

console.log('====================================================');
console.log('       HelpFund Database Initialization Script      ');
console.log('====================================================');
console.log(`Database File Target: ${resolvedDbPath}`);

try {
  // Step 1: Initialize Schema
  console.log('\n[1/3] Applying schema migrations...');
  initDatabase();
  console.log('✓ Tables and indexes applied successfully.');

  // Step 2: Query sqlite_master to verify tables
  console.log('\n[2/3] Verifying created tables...');
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .all();

  console.log('Active Tables in Database:');
  tables.forEach((t) => console.log(`  - [Table] ${t.name}`));

  // Step 3: Query sqlite_master to verify indexes
  console.log('\n[3/3] Verifying performance indexes...');
  const indexes = db
    .prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name;")
    .all();

  indexes.forEach((idx) => console.log(`  - [Index] ${idx.name} on table '${idx.tbl_name}'`));

  console.log('\n====================================================');
  console.log('✓ Database initialization completed successfully!');
  console.log('====================================================\n');
} catch (error) {
  console.error('\n❌ Database initialization failed:', error.message);
  process.exit(1);
}
