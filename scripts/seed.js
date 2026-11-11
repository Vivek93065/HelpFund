/**
 * scripts/seed.js
 * 
 * HelpFund Production Showcase Database Seeder
 * 
 * Populates realistic, high-impact demonstration campaigns, verified PayPal sandbox donations,
 * creator profiles, and pre-computed Gemini AI Trust Scores.
 * 
 * Ensures the platform is immediately vibrant for hackathon judges and demo presentations.
 */

const bcrypt = require('bcryptjs');
const { db, initDatabase, resolvedDbPath } = require('../src/config/db');

console.log('====================================================');
console.log('      HelpFund Showcase Data Seeder                 ');
console.log('====================================================');

async function seed() {
  initDatabase();

  const count = db.prepare('SELECT COUNT(*) AS total FROM campaigns').get().total;
  if (count > 0 && process.env.FORCE_SEED !== 'true') {
    console.log(`Database already has ${count} campaign(s). Skipping seed (use FORCE_SEED=true to overwrite).`);
    return;
  }

  console.log('[1/4] Creating demonstration users...');
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('DemoPassword123!', saltRounds);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, email, password_hash, role, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    1,
    'Dr. Maya Lin, MD',
    'maya.lin@helpfund.org',
    passwordHash,
    'creator',
    'Pediatrician and community healthcare advocate leading clean clinic initiatives.'
  );

  insertUser.run(
    2,
    'Marcus Thorne',
    'marcus@helpfund.org',
    passwordHash,
    'creator',
    'Renewable energy engineer working on rural solar micro-grids and clean water.'
  );

  insertUser.run(
    3,
    'Sarah Jenkins',
    'sarah.jenkins@helpfund.org',
    passwordHash,
    'creator',
    'STEM educator and open-source robotics mentor for underprivileged youth.'
  );

  insertUser.run(
    4,
    'Verified Admin',
    'admin@helpfund.org',
    passwordHash,
    'admin',
    'HelpFund Platform Integrity & Compliance Administrator.'
  );

  console.log('✓ Users created.');

  console.log('[2/4] Seeding showcase campaigns with AI Trust Scores...');

  const futureDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString();
  };

  const campaigns = [
    {
      id: 1,
      user_id: 1,
      title: 'Pediatric Cardiac Surgery Care Packages for Rural Children',
      category: 'Medical',
      short_description: 'Providing subsidized life-saving post-operative cardiac care kits and medicine for children in low-income districts.',
      story_content: `The Challenge

Congenital heart disease affects thousands of children born in regional clinics with limited access to pediatric specialized care. Families often exhaust their life savings just to reach metropolitan surgical centers, leaving zero financial runway for critical post-operative recovery, sterile dressing kits, and anticoagulant therapy.

How Every Dollar Will Be Used

Our $15,000 goal directly finances 60 individualized post-surgical rehabilitation kits ($250 per child).
- 45% ($6,750): Specialized pediatric medications, anti-clotting therapy, and digital pulse oximeters.
- 35% ($5,250): Sterile surgical wound-care dressings and infection monitoring supplies for 90 days.
- 20% ($3,000): Follow-up telehealth transport and in-home visiting pediatric nurse sessions.

Immediate Impact

Every single dollar ensures that a child who survived open-heart surgery recovers safely without dangerous post-surgical infection or relapse. We publish full receipts and nurse visit verification reports for every child funded.`,
      target_amount: 15000,
      raised_amount: 11450,
      deadline: futureDate(24),
      image_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
      status: 'active',
      ai_trust_score: 96,
      ai_analysis_summary: JSON.stringify({
        trust_score: 96,
        credibility_level: 'High',
        transparency_indicators: {
          budget_itemization: true,
          clear_beneficiary: true,
          realistic_timeline: true
        },
        strengths: [
          'Exemplary itemized budget with percentage and dollar breakdowns.',
          'Explicit beneficiary group (60 post-operative children in regional clinics).',
          'Verifiable deliverable with nurse follow-up reports.'
        ],
        missing_or_vague_areas: ['No significant concerns identified.'],
        actionable_recommendations: ['Post first cohort discharge photos as a campaign update.'],
        disclaimer: 'This score is an automated AI-generated advisory assessment based on text transparency and verifiability indicators.'
      })
    },
    {
      id: 2,
      user_id: 2,
      title: 'Solar-Powered Clean Water Well for Arid Farming Communities',
      category: 'Community',
      short_description: 'Constructing a resilient solar-pumped deep aquifer well supplying 2,500 villagers with safe, free drinking water.',
      story_content: `The Challenge

In the drylands of our northern valley, over 2,500 residents walk over 6 kilometers daily to retrieve water from contaminated open boreholes. Waterborne illness has caused children to miss 30% of school sessions over the past dry season.

How Every Dollar Will Be Used

We have partnered with accredited hydrologists and local engineering contractors to install a 120-meter deep solar submersible borehole.
- Phase 1: Deep Geological Drilling & Casing ($6,500)
- Phase 2: Tier-1 Monocrystalline Solar Array & 5.5kW Submersible Pump ($4,800)
- Phase 3: 15,000-Liter Elevated Storage Tank & 4 Public Dispensing Taps ($2,700)

Immediate Impact

Clean, continuous water availability will eliminate waterborne typhoid risks, free 4 hours of daily transit time for women and children, and support community drip irrigation for vegetable farming.`,
      target_amount: 14000,
      raised_amount: 9800,
      deadline: futureDate(18),
      image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=1200&q=80',
      status: 'active',
      ai_trust_score: 93,
      ai_analysis_summary: JSON.stringify({
        trust_score: 93,
        credibility_level: 'High',
        transparency_indicators: {
          budget_itemization: true,
          clear_beneficiary: true,
          realistic_timeline: true
        },
        strengths: [
          'Comprehensive phased engineering plan with specific technical deliverables.',
          'Clear community ownership structure and maintenance plan.'
        ],
        missing_or_vague_areas: ['Water testing lab certification entity can be named in updates.'],
        actionable_recommendations: ['Upload hydrological survey certificate upon campaign completion.'],
        disclaimer: 'This score is an automated AI-generated advisory assessment.'
      })
    },
    {
      id: 3,
      user_id: 3,
      title: 'Open Robotics & AI Lab for Public Middle School Students',
      category: 'Education',
      short_description: 'Equipping 120 public school students with open-source robotics kits, microcontrollers, and free AI programming mentors.',
      story_content: `The Challenge

90% of students in our municipal district attend schools with zero STEM laboratory hardware. While robotics and artificial intelligence reshape the world economy, talented young students are left without hands-on hardware to explore engineering.

How Every Dollar Will Be Used

Our $8,500 target directly furnishes a complete mobile robotics and coding laboratory for two consecutive semesters:
- 20 Modular Arduino / ESP32 Robotics Starter Kits ($2,400)
- 10 Refurbished Laptops running open-source Linux programming suites ($3,200)
- Sensors, motors, 3D printer filaments, and tools ($1,800)
- Weekend competition transport and student hackathon registrations ($1,100)

Immediate Impact

120 middle schoolers will construct autonomous rovers, learn Python and microcontroller coding, and participate in regional robotics leagues at zero cost to their families.`,
      target_amount: 8500,
      raised_amount: 6200,
      deadline: futureDate(35),
      image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
      status: 'active',
      ai_trust_score: 91,
      ai_analysis_summary: JSON.stringify({
        trust_score: 91,
        credibility_level: 'High',
        transparency_indicators: {
          budget_itemization: true,
          clear_beneficiary: true,
          realistic_timeline: true
        },
        strengths: [
          'Clear curriculum milestones and student participant metrics.',
          'Prudent equipment cost estimation with refurbished hardware.'
        ],
        missing_or_vague_areas: ['Ensure school district agreement letter is posted in updates.'],
        actionable_recommendations: ['Stream student project demonstrations for backers.'],
        disclaimer: 'This score is an automated AI-generated advisory assessment.'
      })
    },
    {
      id: 4,
      user_id: 1,
      title: 'Emergency Flash Flood Relief & Shelter Kits',
      category: 'Emergency',
      short_description: 'Rapid distribution of warm blankets, waterproof tarpaulins, hygiene packs, and portable water purifiers for displaced families.',
      story_content: `The Challenge

Last week's catastrophic rainfall inundated over 350 homes across the coastal lowlands. Displaced families are currently sheltered in community halls without clean dry bedding or infant hygiene supplies.

How Every Dollar Will Be Used

We are working on-the-ground with local emergency response coordinators:
- Immediate Relief: 200 Heavy-duty Waterproof Tarps and Bedding Kits ($4,000)
- Health: 500 Family Water Purification Filters (removes 99.9% pathogens) ($3,000)
- Nutrition: Infant formula, dry rations, and baby sanitation essentials ($3,000)

Immediate Impact

Every contribution delivers physical, tangible aid directly into the hands of families within 24 hours of funding. All procurement is conducted via local suppliers to maximize speed.`,
      target_amount: 10000,
      raised_amount: 8750,
      deadline: futureDate(12),
      image_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1200&q=80',
      status: 'active',
      ai_trust_score: 89,
      ai_analysis_summary: JSON.stringify({
        trust_score: 89,
        credibility_level: 'High',
        transparency_indicators: {
          budget_itemization: true,
          clear_beneficiary: true,
          realistic_timeline: true
        },
        strengths: [
          'Urgent need with immediate relief deliverables specified.',
          'Local procurement strategy reduces overhead and shipping delay.'
        ],
        missing_or_vague_areas: ['Add official NGO/charity registry or local partner details.'],
        actionable_recommendations: ['Post live dispatch photos as aid trucks depart.'],
        disclaimer: 'This score is an automated AI-generated advisory assessment.'
      })
    },
    {
      id: 5,
      user_id: 3,
      title: 'Community Mural & Public Youth Arts Pavilion',
      category: 'Creative',
      short_description: 'Revitalizing an abandoned industrial lot into an open-air art park with community murals and free weekend pottery classes.',
      story_content: `The Challenge

Our downtown neighborhood has experienced declining public spaces, leaving youth with few safe, constructive creative outlets after school hours.

How Every Dollar Will Be Used

We are transforming a donated 4,000 sq ft lot into an accessible arts oasis:
- Surface prep, eco-friendly exterior mural paints and sealant ($2,200)
- Heavy-duty outdoor wooden easels, worktables and benches ($1,800)
- Art supplies for 6 months of free weekend workshops ($1,500)
- Solar path lighting and accessibility ramps ($1,000)

Immediate Impact

Over 300 neighborhood residents will co-create a public landmark celebrating local cultural heritage, fostering community safety and pride.`,
      target_amount: 6500,
      raised_amount: 4100,
      deadline: futureDate(40),
      image_url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
      status: 'active',
      ai_trust_score: 87,
      ai_analysis_summary: JSON.stringify({
        trust_score: 87,
        credibility_level: 'High',
        transparency_indicators: {
          budget_itemization: true,
          clear_beneficiary: true,
          realistic_timeline: true
        },
        strengths: ['Tangible community asset creation', 'Transparent material budget breakdown'],
        missing_or_vague_areas: ['Permit verification with municipal council can be linked.'],
        actionable_recommendations: ['Host a community open-mic night during opening week.'],
        disclaimer: 'This score is an automated AI-generated advisory assessment.'
      })
    },
    {
      id: 6,
      user_id: 2,
      title: 'Wildlife Sanctuary Forest Fire Early-Warning Network',
      category: 'Non-Profit',
      short_description: 'Deploying low-cost IoT smoke and thermal sensor nodes to safeguard 500 acres of endangered bird and animal sanctuary.',
      story_content: `The Challenge

Recent summer droughts have increased wildfire risks tenfold in our municipal wildlife sanctuary. Traditional satellite alerts often detect fires only after dozens of canopy acres are already consumed.

How Every Dollar Will Be Used

We are deploying an automated early-warning sensor mesh:
- 30 Solar-powered LoRaWAN smoke and temperature sensor towers ($3,600)
- 2 Gateway receivers connected to local ranger fire stations ($1,400)
- Alert gateway software and battery backups ($1,200)
- Fire-retardant boundary clearance tools ($1,300)

Immediate Impact

Sensors detect smoke spikes in under 90 seconds, alerting volunteer rangers before spot fires spread across canopy corridors.`,
      target_amount: 7500,
      raised_amount: 5350,
      deadline: futureDate(28),
      image_url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
      status: 'active',
      ai_trust_score: 94,
      ai_analysis_summary: JSON.stringify({
        trust_score: 94,
        credibility_level: 'High',
        transparency_indicators: {
          budget_itemization: true,
          clear_beneficiary: true,
          realistic_timeline: true
        },
        strengths: ['High technical feasibility', 'Direct environmental protection impact'],
        missing_or_vague_areas: ['Ranger department MOU status.'],
        actionable_recommendations: ['Publish open sensor telemetry on dashboard.'],
        disclaimer: 'This score is an automated AI-generated advisory assessment.'
      })
    }
  ];

  const insertCampaign = db.prepare(`
    INSERT OR REPLACE INTO campaigns (
      id, user_id, title, category, short_description, story_content,
      target_amount, raised_amount, deadline, image_url, status,
      ai_trust_score, ai_analysis_summary
    ) VALUES (
      @id, @user_id, @title, @category, @short_description, @story_content,
      @target_amount, @raised_amount, @deadline, @image_url, @status,
      @ai_trust_score, @ai_analysis_summary
    )
  `);

  campaigns.forEach((c) => {
    insertCampaign.run(c);
    console.log(`  + [Campaign #${c.id}] ${c.title.substring(0, 45)}... ($${c.raised_amount}/$${c.target_amount})`);
  });

  console.log('[3/4] Seeding verified PayPal sandbox donations...');

  const insertDonation = db.prepare(`
    INSERT OR IGNORE INTO donations (
      campaign_id, user_id, donor_name, donor_email, amount, currency,
      paypal_order_id, paypal_capture_id, payment_status, donor_message, is_anonymous, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleDonations = [
    [1, null, 'Elena Vasquez', 'elena.v@example.com', 150.00, 'USD', 'PAYPAL-DEMO-ORD-101', 'PAYPAL-DEMO-CAP-101', 'COMPLETED', 'Praying for all the brave little warriors! Keep shining.', 0, '2026-11-10 14:22:00'],
    [1, null, 'Anonymous Backer', 'donor@example.com', 500.00, 'USD', 'PAYPAL-DEMO-ORD-102', 'PAYPAL-DEMO-CAP-102', 'COMPLETED', 'For the post-surgery recovery kits. Bless the surgical team.', 1, '2026-11-10 18:40:00'],
    [1, null, 'David Chen', 'david.c@example.com', 75.00, 'USD', 'PAYPAL-DEMO-ORD-103', 'PAYPAL-DEMO-CAP-103', 'COMPLETED', 'Every child deserves a healthy heart.', 0, '2026-11-11 09:15:00'],
    [2, null, 'Amina Patel', 'amina@example.com', 250.00, 'USD', 'PAYPAL-DEMO-ORD-201', 'PAYPAL-DEMO-CAP-201', 'COMPLETED', 'Water is life. Wonderful project, Marcus!', 0, '2026-11-09 11:30:00'],
    [2, null, 'Clean Future Fund', 'giving@cleanfuture.org', 1000.00, 'USD', 'PAYPAL-DEMO-ORD-202', 'PAYPAL-DEMO-CAP-202', 'COMPLETED', 'Matching local community contributions for the solar pump.', 0, '2026-11-10 16:05:00'],
    [3, null, 'Prof. Liam O\'Connor', 'liam.oc@example.com', 100.00, 'USD', 'PAYPAL-DEMO-ORD-301', 'PAYPAL-DEMO-CAP-301', 'COMPLETED', 'Inspiring the next generation of engineers! Best of luck.', 0, '2026-11-11 12:45:00'],
    [4, null, 'Community Solidarity', 'relief@solidarity.org', 350.00, 'USD', 'PAYPAL-DEMO-ORD-401', 'PAYPAL-DEMO-CAP-401', 'COMPLETED', 'Emergency blankets and clean water for our neighbors.', 0, '2026-11-11 15:10:00']
  ];

  sampleDonations.forEach((d) => insertDonation.run(...d));
  console.log(`✓ Seeded ${sampleDonations.length} verified PayPal sandbox donation entries.`);

  console.log('[4/4] Seeding campaign milestone updates...');
  const insertUpdate = db.prepare(`
    INSERT OR IGNORE INTO campaign_updates (id, campaign_id, title, update_text, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertUpdate.run(
    1,
    1,
    'Cohort 1 Medicine Kits Ordered & Dispatch Scheduled!',
    'We have officially finalized orders with certified pediatric pharmaceutical suppliers for the first 25 recovery kits. We anticipate arrival at the district clinic next Tuesday. Thank you to everyone who made this possible!',
    '2026-11-11 16:30:00'
  );

  insertUpdate.run(
    2,
    2,
    'Hydrogeological Soil Survey Completed with Outstanding Results',
    'The drilling crew completed resistivity tests today. An abundant aquifer was detected at 98 meters with exceptional flow pressure. Drilling rig deployment starts Monday!',
    '2026-11-11 17:00:00'
  );

  console.log('✓ Seeded milestone progress updates.');

  console.log('\n====================================================');
  console.log('✓ HelpFund Showcase database seeded successfully!');
  console.log('====================================================\n');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = seed;
