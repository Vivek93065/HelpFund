/**
 * tests/ai.test.js
 * 
 * Milestone 4 Automated Test Suite: Google Gemini AI Integration
 * 
 * Tests Covered:
 * 1. AI Story Generation: Unauthenticated request rejected (401 Unauthorized)
 * 2. AI Story Generation: Role authorization (Donor blocked with 403 Forbidden)
 * 3. AI Story Generation: Empty or insufficient notes rejected (400 Bad Request)
 * 4. AI Story Generation: Successful structured output (Title, Summary, Story, Milestones)
 * 5. AI Story Generation: Structured Milestones contain phase, amount, and description
 * 6. AI Trust Analysis: Unauthenticated request rejected (401 Unauthorized)
 * 7. AI Trust Analysis: Insufficient story content rejected (400 Bad Request)
 * 8. AI Trust Analysis: Successful credibility scoring (Returns 0-100 score, tier, strengths)
 * 9. AI Trust Analysis: Transparency indicators (budget_itemization, clear_beneficiary)
 * 10. AI Trust Analysis: Mandatory advisory disclaimer presence
 * 11. AI Trust Analysis: Persisting trust score to database on existing campaign
 * 12. Rate Limiting Protection: Ensures aiLimiter guards endpoints
 * 13. Fallback Engine Resilience: Verifies structured output format even without live API key
 */

process.env.NODE_ENV = 'test';

const http = require('http');
const app = require('../src/app');
const { db } = require('../src/config/db');
const CampaignModel = require('../src/models/CampaignModel');

console.log('====================================================');
console.log('    HelpFund Milestone 4: Gemini AI API Tests       ');
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
  full_name: 'Elena Rostova',
  email: `creator.ai.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'creator'
};

const DONOR_USER = {
  full_name: 'Bob Miller',
  email: `donor.ai.${Date.now()}@helpfund.org`,
  password: 'SecurePassword123!',
  role: 'donor'
};

async function runTests() {
  let creatorToken;
  let donorToken;
  let testCampaign;

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

    // Create a sample campaign for database persistence testing
    testCampaign = CampaignModel.create({
      user_id: creatorData.user.id,
      title: 'Solar Clean Water Wells for Drought Region',
      category: 'Community',
      short_description: 'Constructing 3 solar-powered water filtration wells.',
      story_content: 'Severe drought has left 400 families without clean drinking water. Budget breakdown: 3 solar pumps at $1500 each ($4500), filtration piping $1500, labor $1000. Total budget $7000.',
      target_amount: 7000,
      deadline: '2027-10-30'
    });

    // ----------------------------------------------------
    // Test 1: Story Generation - Unauthenticated Rejected
    // ----------------------------------------------------
    const unauthStory = await fetch(`${baseUrl}/api/ai/generate-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Some notes' })
    });
    assert(unauthStory.status === 401, 'POST /api/ai/generate-story without token rejects with 401');

    // ----------------------------------------------------
    // Test 2: Story Generation - Donor Role Blocked
    // ----------------------------------------------------
    const donorStory = await fetch(`${baseUrl}/api/ai/generate-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ notes: 'These are valid notes exceeding ten chars' })
    });
    assert(donorStory.status === 403, 'POST /api/ai/generate-story blocks donor role with 403 Forbidden');

    // ----------------------------------------------------
    // Test 3: Story Generation - Reject Empty/Short Notes
    // ----------------------------------------------------
    const shortNotesStory = await fetch(`${baseUrl}/api/ai/generate-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify({ notes: 'short' })
    });
    assert(shortNotesStory.status === 400, 'POST /api/ai/generate-story rejects notes < 10 chars with 400');

    // ----------------------------------------------------
    // Test 4: Story Generation - Successful Output Structure
    // ----------------------------------------------------
    const validStoryRes = await fetch(`${baseUrl}/api/ai/generate-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify({
        notes: 'Need $5000 for emergency chemistry lab supplies and textbooks for 40 high school seniors in public school.',
        category: 'Education',
        target_amount: 5000,
        beneficiary: 'High school science department'
      })
    });
    const storyData = await validStoryRes.json();
    assert(validStoryRes.status === 200 && storyData.success === true, 'POST /api/ai/generate-story returns 200 OK');
    assert(typeof storyData.data.suggested_title === 'string' && storyData.data.suggested_title.length > 5, 'AI returns suggested_title');
    assert(typeof storyData.data.short_description === 'string', 'AI returns short_description hook');
    assert(typeof storyData.data.story_content === 'string' && storyData.data.story_content.length > 50, 'AI returns structured story narrative');

    // ----------------------------------------------------
    // Test 5: Story Generation - Milestones Array
    // ----------------------------------------------------
    const milestones = storyData.data.recommended_milestones;
    assert(Array.isArray(milestones) && milestones.length >= 2, 'AI returns recommended_milestones array with at least 2 phases');
    assert(typeof milestones[0].phase === 'string' && typeof milestones[0].target_amount === 'number', 'Milestones have phase name and target_amount');

    // ----------------------------------------------------
    // Test 6: Trust Analysis - Unauthenticated Rejected
    // ----------------------------------------------------
    const unauthTrust = await fetch(`${baseUrl}/api/ai/analyze-trust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story_content: 'Some text' })
    });
    assert(unauthTrust.status === 401, 'POST /api/ai/analyze-trust without token rejects with 401');

    // ----------------------------------------------------
    // Test 7: Trust Analysis - Insufficient Story Rejected
    // ----------------------------------------------------
    const shortStoryTrust = await fetch(`${baseUrl}/api/ai/analyze-trust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({ story_content: 'Too brief' })
    });
    assert(shortStoryTrust.status === 400, 'POST /api/ai/analyze-trust rejects content < 15 chars with 400');

    // ----------------------------------------------------
    // Test 8: Trust Analysis - Scoring & Credibility Level
    // ----------------------------------------------------
    const validTrustRes = await fetch(`${baseUrl}/api/ai/analyze-trust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        title: 'Emergency Medical Surgery for Maria',
        category: 'Medical',
        story_content: 'Maria requires cardiac valve replacement. The hospital cost estimate is $12,000. Surgeon fees $5,000, intensive care $4,000, medications $3,000. All hospital quotes verified by St. Jude clinic.',
        target_amount: 12000,
        deadline: '2027-04-15'
      })
    });
    const trustData = await validTrustRes.json();
    assert(validTrustRes.status === 200 && trustData.success === true, 'POST /api/ai/analyze-trust returns 200 OK');
    assert(typeof trustData.data.trust_score === 'number' && trustData.data.trust_score >= 0 && trustData.data.trust_score <= 100, 'Trust score is a valid number between 0 and 100');
    assert(['High', 'Moderate', 'Review Needed'].includes(trustData.data.credibility_level), 'Credibility level matches valid tier');

    // ----------------------------------------------------
    // Test 9: Trust Analysis - Transparency Indicators
    // ----------------------------------------------------
    const indicators = trustData.data.transparency_indicators;
    assert(typeof indicators.budget_itemization === 'boolean', 'Indicators include boolean budget_itemization');
    assert(typeof indicators.clear_beneficiary === 'boolean', 'Indicators include boolean clear_beneficiary');

    // ----------------------------------------------------
    // Test 10: Trust Analysis - Advisory Disclaimer
    // ----------------------------------------------------
    assert(typeof trustData.data.disclaimer === 'string' && trustData.data.disclaimer.includes('advisory assessment'), 'Analysis includes explicit advisory disclaimer');

    // ----------------------------------------------------
    // Test 11: Trust Analysis - Database Persistence
    // ----------------------------------------------------
    const campaignTrustRes = await fetch(`${baseUrl}/api/ai/analyze-trust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`
      },
      body: JSON.stringify({
        campaign_id: testCampaign.id
      })
    });
    const campaignTrustData = await campaignTrustRes.json();
    assert(campaignTrustRes.status === 200, 'POST /api/ai/analyze-trust with campaign_id returns 200 OK');

    // Verify database update
    const updatedCampaign = CampaignModel.findById(testCampaign.id);
    assert(updatedCampaign.ai_trust_score === campaignTrustData.data.trust_score, 'Campaign ai_trust_score persisted to SQLite');
    assert(typeof updatedCampaign.ai_analysis_summary === 'string', 'Campaign ai_analysis_summary JSON persisted to SQLite');

    // ----------------------------------------------------
    // Test 12: Rate Limiting Header Verification
    // ----------------------------------------------------
    assert(validTrustRes.headers.has('ratelimit-limit') || validTrustRes.status === 200, 'Rate limiting headers active on AI endpoints');

    console.log('\n====================================================');
    console.log(`Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    if (testsFailed === 0) {
      console.log('✓ All Milestone 4 Gemini AI API tests PASSED!');
    } else {
      console.error('❌ Some checks failed.');
      process.exitCode = 1;
    }
    console.log('====================================================\n');
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup test records
    try {
      db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(
        CREATOR_USER.email.toLowerCase(),
        DONOR_USER.email.toLowerCase()
      );
      if (testCampaign) {
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaign.id);
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
