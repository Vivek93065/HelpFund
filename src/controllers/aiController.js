/**
 * src/controllers/aiController.js
 * 
 * Google Gemini AI Controller
 * 
 * Endpoints:
 * - POST /api/ai/generate-story  : Generates structured pitch, title, and milestones from notes
 * - POST /api/ai/analyze-trust   : Calculates trust score & transparency recommendations
 */

const GeminiService = require('../services/geminiService');
const CampaignModel = require('../models/CampaignModel');
const ImageGenerationService = require('../services/imageGenerationService');

class AiController {
  /**
   * Generates a structured campaign proposal from raw notes.
   * POST /api/ai/generate-story
   */
  static async generateStory(req, res, next) {
    try {
      const { notes, category, target_amount, beneficiary } = req.body;

      if (!notes || typeof notes !== 'string' || notes.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Please provide at least 10 characters of rough notes or bullet points.'
        });
      }

      const generated = await GeminiService.generateCampaignStory({
        notes: notes.trim(),
        category: category || 'Community',
        target_amount: parseFloat(target_amount) || 5000,
        beneficiary: beneficiary ? beneficiary.trim() : 'our community'
      });

      return res.status(200).json({
        success: true,
        data: generated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Analyzes campaign credibility, budget clarity, and transparency indicators.
   * POST /api/ai/analyze-trust
   */
  static async analyzeTrust(req, res, next) {
    try {
      const { campaign_id, title, category, short_description, story_content, target_amount, deadline } = req.body;

      let campaignData;

      if (campaign_id) {
        campaignData = CampaignModel.findById(campaign_id);
        if (!campaignData) {
          return res.status(404).json({
            success: false,
            error: 'Campaign not found.'
          });
        }
      } else {
        if (!story_content || story_content.trim().length < 15) {
          return res.status(400).json({
            success: false,
            error: 'Story content of at least 15 characters is required for credibility evaluation.'
          });
        }

        campaignData = {
          title: title || 'Draft Campaign',
          category: category || 'Other',
          short_description: short_description || '',
          story_content: story_content.trim(),
          target_amount: parseFloat(target_amount) || 1000,
          deadline: deadline || ''
        };
      }

      const analysis = await GeminiService.analyzeCampaignTrust(campaignData);

      // If tied to an existing database campaign, persist the trust score & summary
      if (campaign_id && campaignData) {
        CampaignModel.update(campaign_id, {
          ai_trust_score: analysis.trust_score,
          ai_analysis_summary: JSON.stringify(analysis)
        });
      }

      return res.status(200).json({
        success: true,
        data: analysis
      });
    } catch (error) {
      next(error);
    }
  }
    /**
   * Generates an AI illustration for a campaign.
   * POST /api/ai/generate-image
   */
  static async generateImage(req, res, next) {
    try {
      const { title, category, description } = req.body;

      if (
        !title || typeof title !== 'string' ||
        !category || typeof category !== 'string' ||
        !description || typeof description !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Campaign title, category and description are required.'
        });
      }

      if (
        title.trim().length < 5 ||
        title.length > 150 ||
        description.trim().length < 10 ||
        description.length > 1000
      ) {
        return res.status(400).json({
          success: false,
          error: 'Please provide valid campaign details.'
        });
      }

      const image = await ImageGenerationService.generateCampaignImage({
        title: title.trim(),
        category: category.trim(),
        description: description.trim()
      });

      return res.status(200).json({
        success: true,
        data: {
          image,
          mimeType: 'image/jpeg'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AiController;
