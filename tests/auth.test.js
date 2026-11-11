/**
 * tests/auth.test.js
 * 
 * Milestone 2 Automated API Test Suite: Authentication & Role-Based Access Control
 * 
 * Features Tested:
 * 1. Health check endpoint (GET /api/health)
 * 2. Registration validation (rejection of malformed email / weak password)
 * 3. Successful user registration (bcrypt password hashing, JWT issuance)
 * 4. Duplicate email prevention (409 Conflict)
 * 5. Authentication security (rejection of wrong password / unknown user)
 * 6. Successful login (credential verification, JWT issuance)
 * 7. Protected route authorization (GET /api/auth/me with Bearer token)
 * 8. Role-Based Access Control (RBAC) (GET /api/auth/admin-summary for creator vs admin)
 * 
 * Architecture:
 * - Boots Express on an ephemeral port (OS-assigned, zero port collisions).
 * - Uses native Node.js 22 fetch() API.
 * - Cleans up test user records after execution.
 */

process.env.NODE_ENV = 'test';

const http = require('http');
const app = require('../src/app');
const { db } = require('../src/config/db');

console.log('====================================================');
console.log('    HelpFund Milestone 2: Auth & RBAC API Tests     ');
console.log('====================================================\n');

let server;
let baseUrl;
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

// Unique test credentials to prevent collisions
const TEST_CREATOR = {
  full_name: 'Sarah Connor',
  email: `sarah.test.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'creator',
  bio: 'Community organizer for clean water projects.'
};

const TEST_ADMIN = {
  full_name: 'Admin User',
  email: `admin.test.${Date.now()}@helpfund.org`,
  password: 'AdminPassword999!',
  role: 'admin'
};

async function runTests() {
  try {
    // Start server on an ephemeral port (port 0)
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        console.log(`[Test Server] Running on ${baseUrl} (Test Environment)\n`);
        resolve();
      });
    });

    // ----------------------------------------------------
    // Test 1: API Health Check
    // ----------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'healthy', 'GET /api/health returns 200 healthy');

    // ----------------------------------------------------
    // Test 2: Validation - Reject malformed email
    // ----------------------------------------------------
    const badEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'John Doe',
        email: 'not-an-email',
        password: 'Password123'
      })
    });
    const badEmailData = await badEmailRes.json();
    assert(badEmailRes.status === 400 && badEmailData.errors.length > 0, 'POST /api/auth/register rejects invalid email with 400');

    // ----------------------------------------------------
    // Test 3: Validation - Reject weak password (< 8 chars or no numbers)
    // ----------------------------------------------------
    const weakPassRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'weak'
      })
    });
    assert(weakPassRes.status === 400, 'POST /api/auth/register rejects weak password with 400');

    // ----------------------------------------------------
    // Test 4: Successful User Registration
    // ----------------------------------------------------
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREATOR)
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.success === true, 'POST /api/auth/register creates user with 201 Created');
    assert(typeof regData.token === 'string', 'Registration response includes signed JWT token');
    assert(regData.user.password_hash === undefined, 'Registration response securely excludes password_hash');
    assert(regData.user.email === TEST_CREATOR.email.toLowerCase(), 'Registered email is properly normalized');

    const creatorToken = regData.token;

    // ----------------------------------------------------
    // Test 5: Duplicate Email Rejection
    // ----------------------------------------------------
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREATOR)
    });
    assert(dupRes.status === 409, 'POST /api/auth/register rejects duplicate email with 409 Conflict');

    // ----------------------------------------------------
    // Test 6: Login - Reject wrong password
    // ----------------------------------------------------
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_CREATOR.email,
        password: 'IncorrectPassword999!'
      })
    });
    assert(wrongPassRes.status === 401, 'POST /api/auth/login rejects incorrect password with 401 Unauthorized');

    // ----------------------------------------------------
    // Test 7: Login - Reject unknown email
    // ----------------------------------------------------
    const unknownUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doesnotexist@helpfund.org',
        password: 'Password123!'
      })
    });
    assert(unknownUserRes.status === 401, 'POST /api/auth/login rejects unknown email with generic 401');

    // ----------------------------------------------------
    // Test 8: Login - Successful Authentication
    // ----------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_CREATOR.email,
        password: TEST_CREATOR.password
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success === true, 'POST /api/auth/login succeeds with 200 OK');
    assert(typeof loginData.token === 'string', 'Login returns valid JWT token');
    assert(loginData.user.password_hash === undefined, 'Login response omits password_hash');

    // ----------------------------------------------------
    // Test 9: Protected Route - Reject missing Bearer token
    // ----------------------------------------------------
    const unauthProfileRes = await fetch(`${baseUrl}/api/auth/me`);
    assert(unauthProfileRes.status === 401, 'GET /api/auth/me rejects unauthenticated request with 401');

    // ----------------------------------------------------
    // Test 10: Protected Route - Succeeds with valid token
    // ----------------------------------------------------
    const authProfileRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` }
    });
    const profileData = await authProfileRes.json();
    assert(authProfileRes.status === 200 && profileData.user.email === TEST_CREATOR.email.toLowerCase(), 'GET /api/auth/me returns user profile with valid Bearer token');

    // ----------------------------------------------------
    // Test 11: Role-Based Access Control - Creator blocked from Admin route
    // ----------------------------------------------------
    const creatorAdminRes = await fetch(`${baseUrl}/api/auth/admin-summary`, {
      headers: { Authorization: `Bearer ${creatorToken}` }
    });
    assert(creatorAdminRes.status === 403, 'GET /api/auth/admin-summary blocks creator role with 403 Forbidden');

    // ----------------------------------------------------
    // Test 12: Role-Based Access Control - Admin succeeds
    // ----------------------------------------------------
    // Register admin user
    const adminRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_ADMIN)
    });
    // Security: self-registering as admin must be rejected (privilege escalation)
    assert(adminRegRes.status === 400, 'POST /api/auth/register rejects role "admin" with 400 (no self-service admin)');

    // Create the admin the safe way: register as creator, then promote directly in the database
    const adminRegRes2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...TEST_ADMIN, role: 'creator' })
    });
    const adminRegData = await adminRegRes2.json();
    const adminToken = adminRegData.token;
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(TEST_ADMIN.email.toLowerCase());

    const adminRes = await fetch(`${baseUrl}/api/auth/admin-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminData = await adminRes.json();
    assert(adminRes.status === 200 && adminData.success === true, 'GET /api/auth/admin-summary allows admin role with 200 OK');

    console.log('\n====================================================');
    console.log(`Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    if (testsFailed === 0) {
      console.log('✓ All Milestone 2 Auth & RBAC API tests PASSED!');
    } else {
      console.error('❌ Some checks failed.');
      process.exitCode = 1;
    }
    console.log('====================================================\n');
  } catch (error) {
    console.error('Unexpected test error:', error);
    process.exitCode = 1;
  } finally {
    // Clean up test records from database
    try {
      db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(
        TEST_CREATOR.email.toLowerCase(),
        TEST_ADMIN.email.toLowerCase()
      );
      console.log('[Cleanup] Test user records cleaned from database.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }

    if (server) {
      server.close();
      console.log('[Cleanup] Test HTTP server closed.');
    }
  }
}

runTests();