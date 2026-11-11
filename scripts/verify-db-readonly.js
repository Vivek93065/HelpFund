/**
 * scripts/verify-db-readonly.js
 * 
 * 100% Read-Only SQLite Integrity & Constraint Verification Script
 * 
 * Safety Guarantees:
 * - Executes only PRAGMA inspection statements and SELECT queries.
 * - Zero INSERT, UPDATE, DELETE, DROP, or ALTER statements.
 * - Strictly read-only access to 'data/helpfund.db'.
 * 
 * Inspections Performed:
 * 1. PRAGMA foreign_key_check: Scans the entire database for any foreign key violations.
 * 2. PRAGMA foreign_key_list: Inspects foreign key relationships and cascade rules for all tables.
 * 3. PRAGMA table_info: Inspects column names, data types, NOT NULL constraints, and defaults.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/helpfund.db');
const db = new Database(dbPath, { readonly: true }); // Open in strict READONLY mode!

console.log('====================================================');
console.log('    HelpFund Non-Destructive Database Verification   ');
console.log('====================================================');
console.log(`Database Target: ${dbPath}`);
console.log(`Readonly Mode  : ${db.readonly ? 'ENABLED (Safe)' : 'DISABLED'}\n`);

// 1. Check for foreign key violations across all tables
console.log('--- [1] Checking for Foreign Key Violations (PRAGMA foreign_key_check) ---');
const fkViolations = db.pragma('foreign_key_check');
if (fkViolations.length === 0) {
  console.log('✓ PASS: Zero foreign key violations detected across all tables.');
} else {
  console.error('❌ FAIL: Violations found:', fkViolations);
}

// 2. Inspect foreign key relationships for child tables
console.log('\n--- [2] Inspecting Foreign Key Relationships (PRAGMA foreign_key_list) ---');
const tablesWithFk = ['campaigns', 'donations', 'campaign_updates'];

tablesWithFk.forEach((tableName) => {
  const fkList = db.pragma(`foreign_key_list(${tableName})`);
  console.log(`\nTable '${tableName}' Foreign Keys:`);
  fkList.forEach((fk) => {
    console.log(
      `  - Column '${fk.from}' -> References '${fk.table}(${fk.to})' [ON DELETE: ${fk.on_delete}, ON UPDATE: ${fk.on_update}]`
    );
  });
});

// 3. Inspect Table Schemas & Column Constraints
console.log('\n--- [3] Inspecting Table Column Constraints (PRAGMA table_info) ---');
const allTables = ['users', 'campaigns', 'donations', 'campaign_updates'];

allTables.forEach((tableName) => {
  const columns = db.pragma(`table_info(${tableName})`);
  console.log(`\nTable '${tableName}' (${columns.length} columns):`);
  columns.forEach((col) => {
    const pkStr = col.pk ? ' [PRIMARY KEY]' : '';
    const notNullStr = col.notnull ? ' [NOT NULL]' : '';
    const defaultStr = col.dflt_value !== null ? ` [DEFAULT: ${col.dflt_value}]` : '';
    console.log(`  - ${col.name} (${col.type})${pkStr}${notNullStr}${defaultStr}`);
  });
});

db.close();
console.log('\n====================================================');
console.log('✓ Non-destructive verification completed successfully!');
console.log('====================================================\n');
