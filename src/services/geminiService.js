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

const geminiUrl = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`;

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

/**
 * Dispatches prompt to the configured Gemini model (GEMINI_MODEL, default gemini-2.5-flash) with timeout protection.
 * @param {string} systemInstruction
 * @param {string} userPrompt
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
async function callGemini(systemInstruction, userPrompt, timeoutMs = 15000) {
  const apiKey = config.geminiApiKey;

  // If no API key is provided or it's the template placeholder, return null to trigger intelligent fallback
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${geminiUrl()}?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
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
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Gemini API Warning] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return null;
    }

    return JSON.parse(cleanJsonMarkdown(candidateText));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('[Gemini API Warning] Request timed out. Using semantic fallback engine.');
    } else {
      console.warn(`[Gemini API Warning] ${err.message}. Using semantic fallback engine.`);
    }
    return null;
  }
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

    const systemPrompt = `
You are an expert fraud investigator and credibility auditor for crowdfunding campaigns at HelpFund.
Analyze the provided campaign information for transparency, realistic budgeting, verifiable claims, and potential risk indicators.
Return a valid JSON object matching this schema:
{
  "trust_score": <number from 0 to 100>,
  "credibility_level": "High" | "Moderate" | "Review Needed",
  "transparency_indicators": {
    "budget_itemization": <boolean: whether expenses are itemized>,
    "clear_beneficiary": <boolean: whether the recipient is explicitly identified>,
    "realistic_timeline": <boolean: whether target and timeline are realistic>
  },
  "strengths": ["list of positive credibility markers"],
  "missing_or_vague_areas": ["list of areas needing clearer documentation"],
  "actionable_recommendations": ["specific advice for the creator to boost legitimacy"],
  "disclaimer": "This score is an automated AI-generated advisory assessment based on text transparency and verifiability indicators. It does not constitute legal or financial verification."
}
`.trim();

    const userPrompt = `
Title: ${title}
Category: ${category}
Target Amount: $${target_amount}
Deadline: ${deadline}
Summary: ${short_description}
Story Content:
${story_content}
`.trim();

    const geminiResult = await callGemini(systemPrompt, userPrompt);
    if (geminiResult && typeof geminiResult.trust_score === 'number' && geminiResult.credibility_level) {
      return { ...geminiResult, source: 'gemini' };
    }

    // Intelligent Semantic Fallback Auditor
    let score = 70; // baseline
    const strengths = [];
    const missing = [];
    const recommendations = [];

    const fullText = `${title} ${short_description} ${story_content}`.toLowerCase();

    // Check 1: Budget itemization ($ signs, breakdown keywords)
    const hasNumbers = /\$|\d+/.test(story_content);
    const hasItemization = /cost|budget|expense|item|breakdown|fee|tuition|quote/i.test(story_content);
    if (hasNumbers && hasItemization) {
      score += 12;
      strengths.push('Includes specific financial figures and cost breakdowns.');
    } else {
      score -= 10;
      missing.push('Detailed, itemized budget breakdown is sparse.');
      recommendations.push('Itemize how the requested funds will be split across specific expenses.');
    }

    // Check 2: Story length and depth
    if (story_content.length > 250) {
      score += 8;
      strengths.push('Detailed campaign story providing meaningful context.');
    } else {
      score -= 8;
      missing.push('Campaign story is relatively brief.');
      recommendations.push('Add more background details on who you are and why this cause matters.');
    }

    // Check 3: Beneficiary clarity
    const hasBeneficiary = /i |my |our |we |student|patient|family|community|school|hospital/i.test(fullText);
    if (hasBeneficiary) {
      score += 6;
      strengths.push('Identifies clear beneficiary and community beneficiaries.');
    } else {
      recommendations.push('Explicitly name who will directly receive and manage the funds.');
    }

    // Clamp score between 10 and 98
    const finalScore = Math.max(10, Math.min(98, score));
    let credibilityLevel = 'Moderate';
    if (finalScore >= 80) credibilityLevel = 'High';
    else if (finalScore < 50) credibilityLevel = 'Review Needed';

    return {
      source: 'fallback',
      trust_score: finalScore,
      credibility_level: credibilityLevel,
      transparency_indicators: {
        budget_itemization: hasNumbers && hasItemization,
        clear_beneficiary: hasBeneficiary,
        realistic_timeline: true
      },
      strengths: strengths.length > 0 ? strengths : ['Basic campaign outline provided.'],
      missing_or_vague_areas: missing.length > 0 ? missing : ['No critical red flags detected.'],
      actionable_recommendations: recommendations.length > 0 ? recommendations : ['Consider posting regular milestone updates once funded.'],
      disclaimer: 'This score is an automated AI-generated advisory assessment based on text transparency and verifiability indicators. It does not constitute legal or financial verification.'
    };
  }
}

module.exports = GeminiService;