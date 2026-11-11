/**
 * tests/campaigns.test.js
 * 
 * Milestone 3 Automated API Test Suite: Campaign Management Core
 * 
 * Tests:
 * 1. Health check & public campaign listing (GET /api/campaigns)
 * 2. Unauthenticated creation rejection (401 Unauthorized)
 * 3. Donor role blocked from creating campaign (403 Forbidden)
 * 4. Validation: Invalid category rejected (400 Bad Request)
 * 5. Validation: Negative/Zero target amount rejected (400 Bad Request)
 * 6. Valid campaign creation by creator (201 Created)
 * 7. Single campaign retrieval with creator details and progress metrics (GET /api/campaigns/:id)
 * 8. Category filtering (GET /api/campaigns?category=Medical)
 * 9. Search query filtering (GET /api/campaigns?search=...)
 * 10. Unauthorized update rejection by non-owner (403 Forbidden)
 * 11. Authorized update by creator (200 OK)
 * 12. Category summary with count (GET /api/campaigns/categories)
 * 13. Authorized deletion by creator (200 OK)
 */

process.env.NODE_ENV = 'test';

const http = require('http');
const app = require('../src/app');
const { db } = require('../src/config/db');

console.log('====================================================');
console.log('    HelpFund Milestone 3: Campaign Core API Tests   ');
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

const CREATOR_USER = {
  full_name: 'Dr. Marcus Vance',
  email: `creator.m3.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'creator',
  bio: 'Pediatric specialist organizing community healthcare clinics.'
};

const DONOR_USER = {
  full_name: 'Alice Cooper',
  email: `donor.m3.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'donor'
};

async function runTests() {
  let creatorToken;
  let donorToken;
  let createdCampaignId;

  try {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        console.log(`[Test Server] Running on ${baseUrl} (Test Environment)\n`);
        resolve();
      });
    });

    // Setup: Register Creator & Donor
    const regCreator = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREATOR_USER)
    });
    const creatorData = await regCreator.json();
    creatorToken = creatorData.token;

    const regDonor = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DONOR_USER)
    });
    const donorData = await regDonor.json();
    donorToken = donorData.token;

    // ----------------------------------------------------
    // Test 1: Public Campaign Listing
    // ----------------------------------------------------
    const listRes = await fetch(`${baseUrl}/api/campaigns`);
    const listData = await listRes.json();
    assert(listRes.status === 200 && Array.isArray(listData.data), 'GET /api/campaigns returns 200 and data array');

    // ----------------------------------------------------
    // Test 2: Unauthenticated creation blocked
    // ----------------------------------------------------
    const unauthCreate = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized' })
    });
    assert(unauthCreate.status === 401, 'POST /api/campaigns without token rejects with 401');

    // ----------------------------------------------------
    // Test 3: Donor role blocked from creating campaign
    // ----------------------------------------------------
    const donorCreate = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        title: 'Donor Trying to Create',
        category: 'Medical',
        short_description: 'Valid short description for testing',
        story_content: 'Valid story content exceeding 20 characters for testing purposes',
        target_amount: 1000,
        deadline: '2027-12-31'
      })
    });
    assert(donorCreate.status === 403, 'POST /api/campaigns blocks donor role with 403 Forbidden');

    // ----------------------------------------------------
    // Test 4: Validation - Invalid Category
    // ----------------------------------------------------
    const badCatCreate = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify({
        title: 'Valid Title Here',
        category: 'NonExistentCategory',
        short_description: 'Valid short description for testing',
        story_content: 'Valid story content exceeding 20 characters for testing purposes',
        target_amount: 1000,
        deadline: '2027-12-31'
      })
    });
    assert(badCatCreate.status === 400, 'POST /api/campaigns rejects invalid category with 400');

    // ----------------------------------------------------
    // Test 5: Validation - Negative Target Amount
    // ----------------------------------------------------
    const badTargetCreate = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify({
        title: 'Valid Title Here',
        category: 'Medical',
        short_description: 'Valid short description for testing',
        story_content: 'Valid story content exceeding 20 characters for testing purposes',
        target_amount: -500,
        deadline: '2027-12-31'
      })
    });
    assert(badTargetCreate.status === 400, 'POST /api/campaigns rejects negative target amount with 400');

    // ----------------------------------------------------
    // Test 6: Successful Campaign Creation
    // ----------------------------------------------------
    const validCampaignPayload = {
      title: 'Pediatric Mobile Clinic for Rural Communities',
      category: 'Medical',
      short_description: 'Delivering basic pediatric screenings and medications to children in remote villages.',
      story_content: 'Healthcare access remains a critical hurdle for remote farming villages. Our team of certified volunteer pediatricians will provide free preventative screenings, essential immunizations, and clean medical kits to over 500 families.',
      target_amount: 7500,
      deadline: '2027-06-30'
    };

    const createRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify(validCampaignPayload)
    });
    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.success === true, 'POST /api/campaigns creates campaign with 201 Created');
    assert(typeof createData.campaign.id === 'number', 'Created campaign returns integer ID');
    assert(createData.campaign.progress_percentage === 0, 'Initial campaign progress percentage is 0%');
    assert(createData.campaign.days_left > 0, 'Days left metric is correctly computed');

    createdCampaignId = createData.campaign.id;

    // ----------------------------------------------------
    // Test 7: Retrieve Single Campaign by ID
    // ----------------------------------------------------
    const getSingleRes = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`);
    const getSingleData = await getSingleRes.json();
    assert(getSingleRes.status === 200, 'GET /api/campaigns/:id returns 200 OK');
    assert(getSingleData.campaign.creator_name === CREATOR_USER.full_name, 'GET /api/campaigns/:id hydrates creator_name via SQL JOIN');

    // ----------------------------------------------------
    // Test 8: Category Filtering
    // ----------------------------------------------------
    const filterCatRes = await fetch(`${baseUrl}/api/campaigns?category=Medical`);
    const filterCatData = await filterCatRes.json();
    const allMatchCat = filterCatData.data.every((c) => c.category === 'Medical');
    assert(filterCatRes.status === 200 && allMatchCat && filterCatData.data.length > 0, 'GET /api/campaigns?category=Medical filters correctly');

    // ----------------------------------------------------
    // Test 9: Search Query Filtering
    // ----------------------------------------------------
    const searchRes = await fetch(`${baseUrl}/api/campaigns?search=Pediatric`);
    const searchData = await searchRes.json();
    const hasSearchMatch = searchData.data.some((c) => c.title.includes('Pediatric'));
    assert(searchRes.status === 200 && hasSearchMatch, 'GET /api/campaigns?search=Pediatric finds matching campaigns');

    // ----------------------------------------------------
    // Test 10: Unauthorized Update (by Donor)
    // ----------------------------------------------------
    const unauthUpdate = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ title: 'Hacked Title Attempt' })
    });
    assert(unauthUpdate.status === 403, 'PUT /api/campaigns/:id blocks non-owner with 403 Forbidden');

    // ----------------------------------------------------
    // Test 11: Authorized Update (by Creator)
    // ----------------------------------------------------
    const authUpdate = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify({
        title: 'Pediatric Mobile Clinic (Updated Expansion)',
        target_amount: 8500
      })
    });
    const authUpdateData = await authUpdate.json();
    assert(authUpdate.status === 200 && authUpdateData.campaign.target_amount === 8500, 'PUT /api/campaigns/:id allows owner update with 200 OK');

    // ----------------------------------------------------
    // Test 12: Categories Summary
    // ----------------------------------------------------
    const catSummaryRes = await fetch(`${baseUrl}/api/campaigns/categories`);
    const catSummaryData = await catSummaryRes.json();
    assert(catSummaryRes.status === 200 && Array.isArray(catSummaryData.categories), 'GET /api/campaigns/categories returns grouped category counts');

    // ----------------------------------------------------
    // Test 13: Authorized Deletion
    // ----------------------------------------------------
    const deleteRes = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creatorToken}` }
    });
    assert(deleteRes.status === 200, 'DELETE /api/campaigns/:id allows owner deletion with 200 OK');

    // Verify deletion
    const verifyDelete = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`);
    assert(verifyDelete.status === 404, 'Deleted campaign returns 404 Not Found on subsequent requests');

    console.log('\n====================================================');
    console.log(`Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    if (testsFailed === 0) {
      console.log('✓ All Milestone 3 Campaign Core API tests PASSED!');
    } else {
      console.error('❌ Some checks failed.');
      process.exitCode = 1;
    }
    console.log('====================================================\n');
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exitCode = 1;
  } finally {
    // Clean up test records
    try {
      db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(
        CREATOR_USER.email.toLowerCase(),
        DONOR_USER.email.toLowerCase()
      );
      if (createdCampaignId) {
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(createdCampaignId);
      }
      console.log('[Cleanup] Test database records cleaned.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr.message);
    }

    if (server) {
      server.close();
      console.log('[Cleanup] Test HTTP server closed.');
    }
  }
}

runTests();
