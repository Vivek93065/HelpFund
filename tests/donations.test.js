/**
 * tests/donations.test.js
 * 
 * Milestone 5 Automated Test Suite: PayPal Sandbox Payment Integration
 * 
 * Tests Covered:
 * 1. Public client configuration (GET /api/donations/config)
 * 2. Unauthenticated order creation blocked (401 Unauthorized)
 * 3. Invalid campaign ID rejected (404 Not Found)
 * 4. Zero or negative donation amount rejected (400 Bad Request)
 * 5. Excessive donation amount rejected (400 Bad Request)
 * 6. Successful PayPal order creation (201 Created with orderID)
 * 7. Campaign raised_amount is NOT incremented upon order creation
 * 8. Unauthenticated capture blocked (401 Unauthorized)
 * 9. Missing or malformed orderID rejected (400 Bad Request)
 * 10. Successful payment capture & atomic balance increment (200 OK)
 * 11. Database verification: campaign raised_amount correctly incremented
 * 12. Duplicate capture rejected with 409/422 Conflict (Idempotency Protection)
 * 13. Campaign total NOT incremented on duplicate capture attempt
 * 14. Failed / invalid order capture does not increase campaign totals
 * 15. Anonymous donation masks donor identity in public ledger
 * 16. Public campaign donations history returns list and correct metrics
 */

process.env.NODE_ENV = 'test';

const http = require('http');
const app = require('../src/app');
const { db } = require('../src/config/db');
const CampaignModel = require('../src/models/CampaignModel');
const DonationModel = require('../src/models/DonationModel');

console.log('====================================================');
console.log('    HelpFund Milestone 5: PayPal Sandbox Tests      ');
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

const DONOR_USER = {
  full_name: 'Jonathan Sterling',
  email: `donor.m5.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'donor'
};

const CREATOR_USER = {
  full_name: 'Dr. Clara Oswald',
  email: `creator.m5.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'creator'
};

async function runTests() {
  let donorToken;
  let creatorToken;
  let testCampaign;
  let createdOrderId;

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

    // Create a target campaign for donation testing
    testCampaign = CampaignModel.create({
      user_id: creatorData.user.id,
      title: 'Solar Panels for Community Clinic',
      category: 'Medical',
      short_description: 'Installing solar power backup for life-saving clinic refrigeration.',
      story_content: 'Vaccines and medications spoil during regular power grid blackouts. We need $3000 to purchase and install an uninterrupted solar inverter system.',
      target_amount: 3000,
      deadline: '2027-12-31'
    });

    const initialRaised = testCampaign.raised_amount; // Expected: 0.0

    // ----------------------------------------------------
    // Test 1: Public PayPal Client Config
    // ----------------------------------------------------
    const configRes = await fetch(`${baseUrl}/api/donations/config`);
    const configData = await configRes.json();
    assert(configRes.status === 200 && configData.config && configData.config.currency === 'USD', 'GET /api/donations/config returns client config');

    // ----------------------------------------------------
    // Test 2: Unauthenticated Order Creation Blocked
    // ----------------------------------------------------
    const unauthOrderRes = await fetch(`${baseUrl}/api/donations/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: testCampaign.id, amount: 50 })
    });
    assert(unauthOrderRes.status === 401, 'POST /api/donations/create-order without token rejects with 401');

    // ----------------------------------------------------
    // Test 3: Invalid Campaign ID Rejected
    // ----------------------------------------------------
    const badCampaignOrderRes = await fetch(`${baseUrl}/api/donations/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ campaign_id: 999999, amount: 50 })
    });
    assert(badCampaignOrderRes.status === 404, 'POST /api/donations/create-order with invalid campaign_id rejects with 404');

    // ----------------------------------------------------
    // Test 4: Zero / Negative Amount Rejected
    // ----------------------------------------------------
    const zeroAmountRes = await fetch(`${baseUrl}/api/donations/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ campaign_id: testCampaign.id, amount: 0 })
    });
    assert(zeroAmountRes.status === 400, 'POST /api/donations/create-order with amount <= 0 rejects with 400');

    // ----------------------------------------------------
    // Test 5: Excessive Amount (> $50,000) Rejected
    // ----------------------------------------------------
    const excessAmountRes = await fetch(`${baseUrl}/api/donations/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ campaign_id: testCampaign.id, amount: 100000 })
    });
    assert(excessAmountRes.status === 400, 'POST /api/donations/create-order with amount > $50,000 rejects with 400');

    // ----------------------------------------------------
    // Test 6: Successful PayPal Order Creation
    // ----------------------------------------------------
    const orderRes = await fetch(`${baseUrl}/api/donations/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        campaign_id: testCampaign.id,
        amount: 50.0,
        donor_message: 'Keep saving lives!',
        is_anonymous: false
      })
    });
    const orderData = await orderRes.json();
    assert(orderRes.status === 201 && typeof orderData.orderID === 'string', 'POST /api/donations/create-order returns 201 with PayPal orderID');
    createdOrderId = orderData.orderID;

    // ----------------------------------------------------
    // Test 7: Campaign Raised Amount Is NOT Changed on Creation
    // ----------------------------------------------------
    const checkCampaignAfterOrder = CampaignModel.findById(testCampaign.id);
    assert(checkCampaignAfterOrder.raised_amount === initialRaised, 'Campaign raised_amount remains unchanged upon order creation');

    // ----------------------------------------------------
    // Test 8: Unauthenticated Capture Blocked
    // ----------------------------------------------------
    const unauthCaptureRes = await fetch(`${baseUrl}/api/donations/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: createdOrderId, campaign_id: testCampaign.id })
    });
    assert(unauthCaptureRes.status === 401, 'POST /api/donations/capture-order without token rejects with 401');

    // ----------------------------------------------------
    // Test 9: Missing / Invalid OrderID Rejected
    // ----------------------------------------------------
    const missingOrderCapture = await fetch(`${baseUrl}/api/donations/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ orderID: '', campaign_id: testCampaign.id })
    });
    assert(missingOrderCapture.status === 400, 'POST /api/donations/capture-order with empty orderID rejects with 400');

    // ----------------------------------------------------
    // Test 10: Successful Payment Capture & Verification
    // ----------------------------------------------------
    const captureRes = await fetch(`${baseUrl}/api/donations/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        orderID: createdOrderId,
        campaign_id: testCampaign.id,
        donor_message: 'Proud to support this medical initiative!',
        is_anonymous: false
      })
    });
    const captureData = await captureRes.json();
    assert(captureRes.status === 200 && captureData.success === true, 'POST /api/donations/capture-order returns 200 OK');
    assert(typeof captureData.receipt.capture_id === 'string', 'Capture response includes unique transaction capture_id');
    assert(captureData.receipt.amount === 50.0, 'Capture response confirms verified amount ($50.00)');

    // ----------------------------------------------------
    // Test 11: Database Verification: Raised Amount Incremented
    // ----------------------------------------------------
    const checkCampaignAfterCapture = CampaignModel.findById(testCampaign.id);
    assert(checkCampaignAfterCapture.raised_amount === initialRaised + 50.0, 'Campaign raised_amount atomically incremented by exactly $50.00');

    // ----------------------------------------------------
    // Test 12: Duplicate Capture Rejected (Idempotency Protection)
    // ----------------------------------------------------
    const duplicateCaptureRes = await fetch(`${baseUrl}/api/donations/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        orderID: createdOrderId,
        campaign_id: testCampaign.id
      })
    });
    assert(duplicateCaptureRes.status === 409 || duplicateCaptureRes.status === 422, 'Duplicate capture attempt correctly rejected with 409/422');

    // ----------------------------------------------------
    // Test 13: Campaign Balance NOT Incremented on Duplicate
    // ----------------------------------------------------
    const checkCampaignAfterDuplicate = CampaignModel.findById(testCampaign.id);
    assert(checkCampaignAfterDuplicate.raised_amount === initialRaised + 50.0, 'Campaign balance is NOT increased by duplicate capture attempts');

    // ----------------------------------------------------
    // Test 14: Failed / Bogus Order Does Not Increment Balance
    // ----------------------------------------------------
    const bogusCaptureRes = await fetch(`${baseUrl}/api/donations/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        orderID: 'BOGUS-NON-EXISTENT-ORDER-999',
        campaign_id: testCampaign.id
      })
    });
    assert(bogusCaptureRes.status === 404 || bogusCaptureRes.status === 400, 'Bogus order capture fails');
    const checkCampaignAfterBogus = CampaignModel.findById(testCampaign.id);
    assert(checkCampaignAfterBogus.raised_amount === initialRaised + 50.0, 'Campaign balance unchanged after failed/bogus payment');

    // ----------------------------------------------------
    // Test 15: Anonymous Donation Privacy Masking
    // ----------------------------------------------------
    // Make second donation anonymously ($25)
    const anonOrderRes = await fetch(`${baseUrl}/api/donations/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        campaign_id: testCampaign.id,
        amount: 25.0
      })
    });
    const anonOrderData = await anonOrderRes.json();

    await fetch(`${baseUrl}/api/donations/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        orderID: anonOrderData.orderID,
        campaign_id: testCampaign.id,
        donor_message: 'Anonymous blessing',
        is_anonymous: true
      })
    });

    // ----------------------------------------------------
    // Test 16: Public Campaign Donations History & Privacy
    // ----------------------------------------------------
    const donationsListRes = await fetch(`${baseUrl}/api/donations/campaign/${testCampaign.id}`);
    const donationsListData = await donationsListRes.json();
    assert(donationsListRes.status === 200, 'GET /api/donations/campaign/:id returns 200 OK');
    assert(donationsListData.data.length === 2, 'Donations list records exactly 2 completed transactions');

    // Check anonymous masking
    const anonDonation = donationsListData.data.find((d) => d.is_anonymous === 1);
    assert(anonDonation && anonDonation.donor_name === 'Anonymous Donor', 'Anonymous donation masks donor name as "Anonymous Donor" in public ledger');
    assert(anonDonation.donor_email === undefined, 'Anonymous donation completely strips donor_email from public response');

    // Check aggregate metrics
    assert(donationsListData.metrics.total_amount === 75.0, 'Aggregate metrics confirm total_amount = $75.00 ($50 + $25)');
    assert(donationsListData.metrics.total_donations === 2, 'Aggregate metrics confirm total_donations = 2');

    console.log('\n====================================================');
    console.log(`Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    if (testsFailed === 0) {
      console.log('✓ All Milestone 5 PayPal Sandbox tests PASSED!');
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
      if (testCampaign) {
        db.prepare('DELETE FROM donations WHERE campaign_id = ?').run(testCampaign.id);
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaign.id);
      }
      db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(
        DONOR_USER.email.toLowerCase(),
        CREATOR_USER.email.toLowerCase()
      );
      console.log('[Cleanup] Test donation, campaign, and user records cleaned.');
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
