/**
 * src/config/db.js
 * 
 * SQLite Database Connection & Schema Migration Module using better-sqlite3
 * 
 * Key Architecture Decisions for College Presentation / Viva:
 * 1. Synchronous Execution: better-sqlite3 runs synchronously in-process. Unlike asynchronous
 *    drivers that introduce event-loop overhead for local files, better-sqlite3 is the fastest
 *    Node.js SQLite driver available.
 * 2. Foreign Key Enforcement: SQLite has foreign keys turned OFF by default for legacy reasons.
 *    We explicitly execute `PRAGMA foreign_keys = ON;` on initialization.
 * 3. WAL Mode (Write-Ahead Logging): `PRAGMA journal_mode = WAL;` allows simultaneous readers
 *    and writers without database locking conflicts.
 * 4. SQL Injection Immunity: All queries use prepared statements (? placeholders) provided by
 *    better-sqlite3.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./env');

// Ensure the directory for the database file exists (e.g. ./data)
const resolvedDbPath = path.resolve(process.cwd(), config.dbPath);
const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite connection
const db = new Database(resolvedDbPath, {
  // verbose: config.nodeEnv === 'development' ? console.log : null
});

// Configure essential SQLite performance and integrity PRAGMAs
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

/**
 * Executes DDL schema statements to create tables and indexes if they don't already exist.
 * Accepts an optional target database instance (defaults to the application db connection)
 * allowing test suites to reuse this schema logic against isolated in-memory databases.
 * 
 * @param {import('better-sqlite3').Database} [targetDb=db]
 * @returns {import('better-sqlite3').Database}
 */
function initDatabase(targetDb = db) {
  const schema = `
    -- Users table: stores campaign creators, donors, and administrators
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'creator' CHECK(role IN ('creator', 'donor', 'admin')),
      avatar_url TEXT DEFAULT NULL,
      bio TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Campaigns table: stores crowdfunding campaigns
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Medical', 'Education', 'Emergency', 'Non-Profit', 'Creative', 'Community', 'Other')),
      short_description TEXT NOT NULL,
      story_content TEXT NOT NULL,
      target_amount REAL NOT NULL CHECK(target_amount > 0),
      raised_amount REAL NOT NULL DEFAULT 0.0 CHECK(raised_amount >= 0),
      deadline DATETIME NOT NULL,
      image_url TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'suspended')),
      ai_trust_score INTEGER DEFAULT NULL CHECK(ai_trust_score IS NULL OR (ai_trust_score >= 0 AND ai_trust_score <= 100)),
      ai_analysis_summary TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Donations table: stores verified PayPal transactions
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id INTEGER DEFAULT NULL,
      donor_name TEXT NOT NULL,
      donor_email TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      paypal_order_id TEXT UNIQUE NOT NULL,
      paypal_capture_id TEXT DEFAULT NULL,
      payment_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(payment_status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
      donor_message TEXT DEFAULT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK(is_anonymous IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Campaign Updates table: allows creators to publish progress milestones
    CREATE TABLE IF NOT EXISTS campaign_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      update_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON donations(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_donations_paypal_order_id ON donations(paypal_order_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_paypal_capture_id
ON donations(paypal_capture_id)
WHERE paypal_capture_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_campaign_updates_campaign_id ON campaign_updates(campaign_id);
  `;

  targetDb.exec(schema);
  return targetDb;
}

module.exports = {
  db,
  initDatabase,
  resolvedDbPath
};
