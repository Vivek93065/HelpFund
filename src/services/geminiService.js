/**
 * src/services/geminiService.js
 *
 * Google Gemini AI Service Adapter
 *
 * Capabilities:
 * 1. AI Campaign Story Assistant: Transforms rough fundraiser notes into engaging,
 *    transparent, empathetic pitches with milestone breakdowns.
 * 2. AI Trust & Credibility Analyzer: Evaluates campaign descriptions for budget
 *    transparency, realistic timelines, and verifiable milestones (assigns 0-100 score).
 *
 * Architecture & Reliability:
 * - Uses native Node.js 22 fetch() with AbortController for network timeout protection.
 * - Enforces structured JSON output parsing with markdown codeblock stripping.
 * - Provides an intelligent semantic fallback engine when GEMINI_API_KEY is not configured
 *   or when operating offline in test environments, ensuring 100% zero-crash resilience.
 */

const config = require('../config/env');

const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

/**
 * Strips potential markdown code blocks (```json ... ```) from Gemini raw output.
 * @param {string} text
 * @returns {string}
 */
function cleanJsonMarkdown(text) {
  if (!text || typeof text !== 'string') return '{}';
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Models to try, in order: the configured model first, then fallbacks.
 * Gemini returns 503 ("model overloaded") often, so having backups matters.
 */
function modelChain() {
  const chain = [config.geminiModel, ...(config.geminiFallbackModels || [])];
  return chain.filter((m, i) => m && chain.indexOf(m) === i);
}

/**
 * Sends one request to one Gemini model.
 * Returns { ok, status, parsed, retryable, fatal } and never throws.
 */
async function requestGeminiModel(model, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${geminiUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Gemini] ${model} -> HTTP ${response.status}: ${errorText.substring(0, 160)}`);
      return {
        ok: false,
        status: response.status,
        retryable: RETRYABLE_STATUS.has(response.status),
        // 401/403 = bad key: no other model will work either
        fatal: response.status === 401 || response.status === 403
      };
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      console.warn(`[Gemini] ${model} returned no text (finish: ${data?.candidates?.[0]?.finishReason || 'unknown'}).`);
      return { ok: false, status: 200, retryable: true };
    }

    try {
      return { ok: true, status: 200, parsed: JSON.parse(cleanJsonMarkdown(candidateText)) };
    } catch (parseErr) {
      console.warn(`[Gemini] ${model} returned invalid/truncated JSON.`);
      return { ok: false, status: 200, retryable: true };
    }
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timed out' : err.message;
    console.warn(`[Gemini] ${model} request ${reason}.`);
    return { ok: false, status: 0, retryable: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calls Gemini with retries + model fallback.
 *  - 503/429/5xx/timeouts: retry the same model with exponential backoff (2 attempts)
 *  - still failing, or model name invalid (400/404): move to the next fallback model
 *  - bad API key (401/403): stop immediately
 * Returns parsed JSON, or null so callers can use their built-in fallback.
 *
 * @param {string} systemInstruction
 * @param {string} userPrompt
 * @param {number} timeoutMs - per-request timeout
 * @returns {Promise<object|null>}
 */
async function callGemini(systemInstruction, userPrompt, timeoutMs = 20000) {
  const apiKey = config.geminiApiKey;

  // No key configured: let the caller use its fallback engine
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    return null;
  }

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: `${systemInstruction}\n\nUser Input Data:\n${userPrompt}\n\nIMPORTANT: Respond ONLY with valid, raw JSON. Do not wrap in conversational text.`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      // Generous limit: thinking-capable models count reasoning tokens here too,
      // and a too-small limit truncates the JSON.
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  });

  const MAX_ATTEMPTS_PER_MODEL = 2;
  const overallDeadline = Date.now() + 90000; // keep the user's wait bounded

  for (const model of modelChain()) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      if (Date.now() > overallDeadline) {
        console.warn('[Gemini] Overall time budget used up. Using fallback engine.');
        return null;
      }

      const result = await requestGeminiModel(model, apiKey.trim(), body, timeoutMs);
      if (result.ok) return result.parsed;
      if (result.fatal) return null;
      // Move to the next model immediately on overload or timeout.
      if (!result.retryable || result.status === 503 || result.status === 0) {
        break;
      }

      if (attempt < MAX_ATTEMPTS_PER_MODEL) {
        await sleep(800 * attempt + Math.floor(Math.random() * 400));
      }
    }
  }

  console.warn('[Gemini] All models/attempts failed. Using fallback engine.');
  return null;
}

class GeminiService {
  /**
   * Generates a polished campaign pitch, title, and milestone breakdown.
   *
   * @param {object} params
   * @param {string} params.notes - Rough bullet points / raw text from user
   * @param {string} params.category - Campaign category (Medical, Education, etc.)
   * @param {number} [params.target_amount] - Optional target amount
   * @param {string} [params.beneficiary] - Intended recipient of funds
   * @returns {Promise<object>}
   */
  static async generateCampaignStory({ notes, category = 'Community', target_amount = 5000, beneficiary = 'our community' }) {

const systemPrompt = `
You are a senior philanthropic grant writer and crowdfunding storytelling expert for the HelpFund platform.

Your task is to transform rough fundraiser notes into an engaging, empathetic, grammatically polished and transparent campaign proposal.

Return a valid JSON object matching this exact schema:
{
  "suggested_title": "A clear, compelling title (max 90 characters)",
  "short_description": "A concise 1-2 sentence summary (max 200 characters)",
  "story_content": "A professionally written plain-text narrative with three section headings: The Challenge, How Every Dollar Will Be Used, and Immediate Impact.",
  "suggested_tags": ["Tag1", "Tag2", "Tag3"],
  "recommended_milestones": [
    { "phase": "Phase 1: Immediate Relief", "target_amount": 2500, "description": "Specific deliverables" },
    { "phase": "Phase 2: Full Implementation", "target_amount": 5000, "description": "Long-term sustainability" }
  ]
}

IMPORTANT WRITING RULES:
- Return valid JSON only.
- Never use Markdown syntax such as ###, ##, **, *, or bullet symbols.
- Use simple section headings without decorative characters.
- Write the story in natural, well-organized paragraphs.
- Keep the short description concise and impactful.
- Do not invent statistics, beneficiary details, expenses or achievements.
- Use only information supported by the user's notes.
- Keep funding breakdowns realistic and consistent with the target amount.
- Make the proposal professional, trustworthy and suitable for a crowdfunding platform.
`.trim();


    const userPrompt = `
Category: ${category}
Target Amount: $${target_amount}
Beneficiary: ${beneficiary}
Raw Fundraiser Notes:
${notes}
`.trim();

    const geminiResult = await callGemini(systemPrompt, userPrompt);
    if (geminiResult && geminiResult.suggested_title && geminiResult.story_content) {
      return { ...geminiResult, source: 'gemini' };
    }

    // Intelligent Semantic Fallback Engine (Active when API key is unconfigured or offline)
    const target = Number(target_amount) || 5000;
    const cleanNotes = notes ? notes.trim() : 'Community project in need of funding.';
    const phase1 = Math.round(target * 0.4);
    const phase2 = target;

    return {
      source: 'fallback', // lets the UI tell the user this is template text, not real AI output
      suggested_title: `Support for ${category} Initiative: ${cleanNotes.substring(0, 45).replace(/\n/g, ' ')}...`,
      short_description: `Join us in supporting ${beneficiary} with urgent ${category.toLowerCase()} funding to achieve lasting community impact.`,

story_content: `The Challenge

${cleanNotes}

How Every Dollar Will Be Used

The campaign aims to raise $${target.toLocaleString()}.
Phase 1: Core Supplies and Logistics - $${phase1.toLocaleString()}.
Phase 2: Project Execution and Delivery - $${(phase2 - phase1).toLocaleString()}.

Immediate Impact

Your support can help ${beneficiary} by contributing toward the campaign goals. Every contribution brings the project closer to its intended outcome. Thank you for your support!`,

      suggested_tags: [category, 'CommunityImpact', 'TransparentGiving'],
      recommended_milestones: [
        {
          phase: 'Phase 1: Critical Launch',
          target_amount: phase1,
          description: 'Procuring foundational supplies and addressing urgent upfront needs.'
        },
        {
          phase: 'Phase 2: Full Project Goal',
          target_amount: phase2,
          description: 'Completing full program objectives with publicly verifiable outcome reports.'
        }
      ]
    };
  }

  /**
   * Analyzes campaign content for transparency, verifiability, and fraud risk indicators.
   *
   * @param {object} campaign
   * @returns {Promise<object>}
   */

static async analyzeCampaignTrust(campaign) {
  const {
    title = '',
    category = 'Other',
    short_description = '',
    story_content = '',
    target_amount = 1000,
    deadline = ''
  } = campaign;

  const criteriaKeys = [
    'beneficiaryTransparency',
    'purposeClarity',
    'budgetBreakdown',
    'timelineMilestones',
    'supportingInformation'
  ];

  const criteriaLabels = {
    beneficiaryTransparency: 'Beneficiary Transparency',
    purposeClarity: 'Purpose Clarity',
    budgetBreakdown: 'Budget Breakdown',
    timelineMilestones: 'Timeline & Milestones',
    supportingInformation: 'Supporting Information'
  };

  const disclaimer =
    'This AI-generated score evaluates the completeness and transparency of campaign information. It does not verify beneficiary identities, documents, claims, or campaign legitimacy.';

  const fullText = [
    title,
    category,
    short_description,
    story_content
  ].join(' ');

  const systemPrompt = `
You are HelpFund's campaign transparency assessment assistant.

Evaluate ONLY information explicitly provided in the campaign.
Never assume missing facts or claim that anything is verified.

Score each of these five criteria independently from 0 to 20.

SCORING:
0 = Completely missing.
5 = Very vague or minimal.
10 = Some information, but important details are missing.
15 = Clear and reasonably detailed.
20 = Specific, detailed and well-structured.

CRITERIA:

1. beneficiaryTransparency:
Is it clear who will directly benefit?
Look for beneficiary identity or group, circumstances and context.

2. purposeClarity:
Is the problem and intended use of funds clearly explained?
Look for a specific objective and why funding is needed.

3. budgetBreakdown:
Are funds explained through specific expenses?
A total target amount alone is NOT an itemized budget.

4. timelineMilestones:
Are timeline and planned milestones explained?
A deadline alone does NOT establish a detailed milestone plan.

5. supportingInformation:
Are useful supporting facts, quantities, locations, references or evidence descriptions provided?
Assess only information mentioned in the text.
Do not claim that documents are verified.

Return ONLY valid JSON:

{
  "criteria": {
    "beneficiaryTransparency": {
      "score": 0,
      "reason": "Explanation"
    },
    "purposeClarity": {
      "score": 0,
      "reason": "Explanation"
    },
    "budgetBreakdown": {
      "score": 0,
      "reason": "Explanation"
    },
    "timelineMilestones": {
      "score": 0,
      "reason": "Explanation"
    },
    "supportingInformation": {
      "score": 0,
      "reason": "Explanation"
    }
  },
  "strengths": ["Specific strengths"],
  "missing_or_vague_areas": ["Missing details"],
  "actionable_recommendations": ["Practical improvements"]
}

Every score must be a number from 0 to 20.
Every reason must be a non-empty string.
Do not calculate a total score.
`.trim();

  const userPrompt = `
Campaign Title: ${title}
Category: ${category}
Target Amount: $${target_amount}
Deadline: ${deadline}

Campaign Summary:
${short_description}

Campaign Story:
${story_content}
`.trim();

  const geminiResult = await callGemini(systemPrompt, userPrompt);

  let criteria = null;
  let strengths = [];
  let missing = [];
  let recommendations = [];
  let source = 'gemini';

  const validGeminiCriteria =
    geminiResult &&
    geminiResult.criteria &&
    criteriaKeys.every((key) => {
      const item = geminiResult.criteria[key];

      return (
        item &&
        typeof item.score === 'number' &&
        Number.isFinite(item.score) &&
        item.score >= 0 &&
        item.score <= 20 &&
        typeof item.reason === 'string' &&
        item.reason.trim().length > 0
      );
    });

  if (validGeminiCriteria) {
    criteria = {};

    criteriaKeys.forEach((key) => {
      criteria[key] = {
        score: Math.round(geminiResult.criteria[key].score),
        maxScore: 20,
        reason: geminiResult.criteria[key].reason.trim()
      };
    });

    strengths = Array.isArray(geminiResult.strengths)
      ? geminiResult.strengths
          .filter((item) => typeof item === 'string')
          .slice(0, 5)
      : [];

    missing = Array.isArray(geminiResult.missing_or_vague_areas)
      ? geminiResult.missing_or_vague_areas
          .filter((item) => typeof item === 'string')
          .slice(0, 5)
      : [];

    recommendations = Array.isArray(geminiResult.actionable_recommendations)
      ? geminiResult.actionable_recommendations
          .filter((item) => typeof item === 'string')
          .slice(0, 5)
      : [];

  } else {
    // Fallback assessment when Gemini is unavailable.
    source = 'fallback';

    const text = fullText.toLowerCase();
    const story = story_content.toLowerCase();

    const hasBeneficiary =
      /\b(student|students|patient|patients|children|families|family|villagers|residents|community|school|hospital|farmers|workers|individuals|people)\b/i.test(text);

    const hasSpecificBeneficiary =
      hasBeneficiary &&
      /\b(for|to support|helping|serving|provide)\b/i.test(text);

    const hasPurpose =
      story_content.trim().length >= 80 &&
      /\b(to provide|to support|to fund|to build|to create|to purchase|to help|because|need|aim|purpose|will provide|will fund)\b/i.test(text);

    const hasBudgetWords =
      /\b(cost|budget|expenses|expense|fees|tuition|equipment|supplies|materials|transport|rent|medicine|itemized|breakdown)\b/i.test(story);

    const amounts = story.match(/\$?\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];

    const hasMultipleExpenses =
      hasBudgetWords && amounts.length >= 2;

    const hasTimelineWords =
      /\b(phase|milestone|week|weeks|month|months|stage|timeline|completion|launch|deliver)\b/i.test(story);

    const hasSupportingDetails =
      amounts.length >= 2 &&
      /\b(location|district|village|hospital|school|clinic|families|students|patients|units|people|meters|kits|equipment|report|reference|survey|quote|receipt|estimate)\b/i.test(text);

    criteria = {
      beneficiaryTransparency: {
        score: hasSpecificBeneficiary ? 20 : hasBeneficiary ? 10 : 0,
        maxScore: 20,
        reason: hasSpecificBeneficiary
          ? 'A beneficiary group and intended recipients are mentioned.'
          : hasBeneficiary
            ? 'A beneficiary group is mentioned, but more specific recipient details are needed.'
            : 'The direct beneficiaries are not clearly identified.'
      },

      purposeClarity: {
        score: hasPurpose ? 20 : story_content.trim().length >= 40 ? 10 : 5,
        maxScore: 20,
        reason: hasPurpose
          ? 'The campaign describes its purpose and funding objective.'
          : 'A more specific explanation of the problem and intended use of funds is needed.'
      },

      budgetBreakdown: {
        score: hasMultipleExpenses ? 20 : hasBudgetWords ? 10 : 0,
        maxScore: 20,
        reason: hasMultipleExpenses
          ? 'Expense-related details and multiple numerical figures are present.'
          : hasBudgetWords
            ? 'Some expense information is present, but an itemized budget is needed.'
            : 'The fundraising target alone does not explain how funds will be spent.'
      },

      timelineMilestones: {
        score: hasTimelineWords && deadline ? 20 : deadline ? 10 : 0,
        maxScore: 20,
        reason: hasTimelineWords && deadline
          ? 'A deadline and timeline-related details are mentioned.'
          : deadline
            ? 'A deadline is provided, but specific milestones are missing.'
            : 'A clear timeline and completion deadline are needed.'
      },

      supportingInformation: {
        score: hasSupportingDetails ? 20 : amounts.length > 0 ? 10 : 5,
        maxScore: 20,
        reason: hasSupportingDetails
          ? 'The campaign includes contextual details and numerical information.'
          : 'Additional factual details and supporting context would improve transparency.'
      }
    };

    strengths = Object.values(criteria)
      .filter((item) => item.score >= 15)
      .map((item) => item.reason);

    missing = Object.entries(criteria)
      .filter(([, item]) => item.score < 15)
      .map(([key]) => `${criteriaLabels[key]} needs more detail.`);

    recommendations = missing.map((item) =>
      `Improve ${item.replace(' needs more detail.', '')} by adding specific information.`
    );

    if (strengths.length === 0) {
      strengths.push('The campaign provides an initial description for assessment.');
    }
  }

  // Backend calculates the final score.
  const trustScore = criteriaKeys.reduce(
    (total, key) => total + criteria[key].score,
    0
  );

  let credibilityLevel = 'Needs Improvement';

  if (trustScore >= 80) credibilityLevel = 'Excellent';
  else if (trustScore >= 60) credibilityLevel = 'Good';
  else if (trustScore >= 40) credibilityLevel = 'Fair';

  return {
    trust_score: trustScore,
    credibility_level: credibilityLevel,
    rating: credibilityLevel,
    criteria,

    // Retained for compatibility with the existing frontend.
    transparency_indicators: {
      budget_itemization: criteria.budgetBreakdown.score >= 15,
      clear_beneficiary: criteria.beneficiaryTransparency.score >= 15,
      realistic_timeline: criteria.timelineMilestones.score >= 15
    },

    strengths,
    missing_or_vague_areas: missing,
    actionable_recommendations: recommendations,
    disclaimer,
    source
  };
}


  /**
   * Predicts tangible real-world impact for a specific donation amount.
   *
   * @param {object} params
   * @param {string} params.campaignTitle
   * @param {string} params.category
   * @param {number} params.amount
   * @param {number} params.targetAmount
   * @returns {Promise<object>}
   */
  static async predictDonationImpact({ campaignTitle, category = 'Community', amount = 25, targetAmount = 5000 }) {
    const systemPrompt = `
You are a philanthropic impact analyst at HelpFund.
Calculate and describe the concrete, real-world impact a specific donation dollar amount will have on this crowdfunding campaign.
Return valid JSON matching this schema:
{
  "impact_summary": "1-2 inspiring sentences describing what this exact dollar amount accomplishes",
  "tangible_deliverables": ["deliverable 1", "deliverable 2"],
  "percentage_of_goal": 2.5
}
Keep it realistic, uplifting, and aligned with the campaign category. Return valid JSON only without markdown syntax.
`.trim();

    const userPrompt = `
Campaign: ${campaignTitle}
Category: ${category}
Goal: $${targetAmount}
Donation Amount: $${amount}
`.trim();

    const geminiResult = await callGemini(systemPrompt, userPrompt);
    if (geminiResult && geminiResult.impact_summary) {
      return { ...geminiResult, source: 'gemini' };
    }

    const pct = targetAmount > 0 ? parseFloat(((amount / targetAmount) * 100).toFixed(1)) : 1;
    const deliverables = {
      Medical: ['Provides essential medical prescription supplies and care materials', 'Covers diagnostic clinic lab fees'],
      Education: ['Provides textbooks, stationery and digital learning packs', 'Funds classroom materials for students'],
      Emergency: ['Supplies emergency shelf-stable meal kits for a family', 'Provides clean bottled drinking water and blankets'],
      'Non-Profit': ['Funds outreach travel and distribution logistics', 'Provides direct community care packages'],
      Creative: ['Purchases essential workshop art and digital production materials', 'Covers studio recording and exhibition fees'],
      Community: ['Funds tools and seedling soil for community revitalization', 'Supports neighborhood improvement workshops']
    };

    const catDeliverables = deliverables[category] || [
      'Directly funds critical supplies and operational resources',
      `Helps achieve vital project milestones on the road to $${Number(targetAmount).toLocaleString()}`
    ];

    return {
      source: 'fallback',
      impact_summary: `Your contribution of $${amount} directly funds vital ${category.toLowerCase()} resources and advances this cause by ${pct}% toward its $${Number(targetAmount).toLocaleString()} target!`,
      tangible_deliverables: catDeliverables,
      percentage_of_goal: pct
    };
  }

  /**
   * Drafts an engaging progress update for backers from raw bullet points.
   *
   * @param {object} params
   * @param {string} params.campaignTitle
   * @param {string} params.rawNotes
   * @param {number} params.raisedAmount
   * @param {number} params.targetAmount
   * @returns {Promise<object>}
   */
  static async draftCampaignUpdate({ campaignTitle, rawNotes, raisedAmount = 0, targetAmount = 1000 }) {
    const systemPrompt = `
You are a senior community communications director at HelpFund.
Transform rough creator bullet points into an inspiring, heartfelt backer progress update.
Return valid JSON matching this schema:
{
  "update_title": "Catchy update headline (max 80 chars)",
  "update_content": "A 2-3 paragraph warm narrative thanking backers and sharing recent milestones",
  "next_milestone": "Short statement on the next upcoming deliverable"
}
Return valid JSON only without markdown formatting.
`.trim();

    const userPrompt = `
Campaign: ${campaignTitle}
Funds Raised So Far: $${raisedAmount} of $${targetAmount}
Creator Progress Notes:
${rawNotes}
`.trim();

    const geminiResult = await callGemini(systemPrompt, userPrompt);
    if (geminiResult && geminiResult.update_title) {
      return { ...geminiResult, source: 'gemini' };
    }

    return {
      source: 'fallback',
      update_title: `Milestone Update: Progress on ${campaignTitle.substring(0, 40)}`,
      update_content: `We wanted to share a heartfelt thank you to all our generous backers! Because of your incredible support, we have already raised $${Number(raisedAmount).toLocaleString()} toward our goal.\n\n${rawNotes}\n\nEvery donation brings us closer to making a lasting difference. Thank you for standing with us!`,
      next_milestone: 'Completing the next operational phase as we approach our target.'
    };
  }
}

module.exports = GeminiService;
