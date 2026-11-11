/**
 * src/controllers/campaignController.js
 * 
 * Campaign Management Request Handler
 * 
 * Enforces business logic, role-based authorization, and calculation of
 * funding metrics (progress percentage, days left).
 */

const CampaignModel = require('../models/CampaignModel');

const VALID_CATEGORIES = [
  'Medical',
  'Education',
  'Emergency',
  'Non-Profit',
  'Creative',
  'Community',
  'Other'
];

/**
 * Calculates days remaining until a given deadline date.
 * @param {string|Date} deadline
 * @returns {number}
 */
function calculateDaysLeft(deadline) {
  const diffTime = new Date(deadline).getTime() - Date.now();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Formats a campaign record with computed frontend metrics.
 * @param {object} campaign
 * @returns {object}
 */
function formatCampaignMetrics(campaign) {
  if (!campaign) return null;
  const target = Number(campaign.target_amount) || 1;
  const raised = Number(campaign.raised_amount) || 0;
  const progress_percentage = Math.min(100, Math.round((raised / target) * 100));
  const days_left = calculateDaysLeft(campaign.deadline);

  return {
    ...campaign,
    progress_percentage,
    days_left,
    is_expired: days_left === 0
  };
}

class CampaignController {
  /**
   * Creates a new campaign with optional banner upload.
   * POST /api/campaigns
   */
  static async createCampaign(req, res, next) {
    try {
      const {
        title,
        category,
        short_description,
        story_content,
        target_amount,
        deadline
      } = req.body;

      const errors = [];

      // Validation
      if (!title || typeof title !== 'string' || title.trim().length < 5) {
        errors.push('Title must be at least 5 characters long.');
      }

      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}.`);
      }

      if (!short_description || short_description.trim().length < 10) {
        errors.push('Short description must be at least 10 characters.');
      }

      if (!story_content || story_content.trim().length < 20) {
        errors.push('Story content must be at least 20 characters.');
      }

      const parsedTarget = parseFloat(target_amount);
      if (isNaN(parsedTarget) || parsedTarget <= 0) {
        errors.push('Target amount must be a positive number greater than 0.');
      }

      if (!deadline || isNaN(new Date(deadline).getTime())) {
        errors.push('A valid deadline date is required.');
      } else if (new Date(deadline).getTime() <= Date.now()) {
        errors.push('Deadline date must be in the future.');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors
        });
      }

      // Handle uploaded file if present
      let image_url = null;
      if (req.file) {
        image_url = `/uploads/campaigns/${req.file.filename}`;
      }

      const campaign = CampaignModel.create({
        user_id: req.user.id,
        title: title.trim(),
        category,
        short_description: short_description.trim(),
        story_content: story_content.trim(),
        target_amount: parsedTarget,
        deadline: new Date(deadline).toISOString().split('T')[0],
        image_url
      });

      return res.status(201).json({
        success: true,
        message: 'Campaign created successfully.',
        campaign: formatCampaignMetrics(campaign)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves paginated list of campaigns with search and category filters.
   * GET /api/campaigns
   */
  static async getCampaigns(req, res, next) {
    try {
      const {
        category,
        search,
        status = 'active',
        sort = 'newest',
        page = 1,
        limit = 12
      } = req.query;

      const result = CampaignModel.findAll({
        category,
        search,
        status,
        sort,
        page: parseInt(page, 10) || 1,
        limit: Math.min(50, parseInt(limit, 10) || 12)
      });

      const formatted = result.campaigns.map(formatCampaignMetrics);

      return res.status(200).json({
        success: true,
        data: formatted,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves detailed single campaign.
   * GET /api/campaigns/:id
   */
  static async getCampaignById(req, res, next) {
    try {
      const campaign = CampaignModel.findById(req.params.id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found.'
        });
      }

      return res.status(200).json({
        success: true,
        campaign: formatCampaignMetrics(campaign)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an existing campaign with ownership check.
   * PUT /api/campaigns/:id
   */
  static async updateCampaign(req, res, next) {
    try {
      const campaign = CampaignModel.findById(req.params.id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found.'
        });
      }

      // Ownership check: only the creator or an admin can update
      if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to modify this campaign.'
        });
      }

      const updateData = { ...req.body };

      // Protect trust-critical fields: AI scores are set only by the AI audit endpoint,
      // and only admins may change campaign status (e.g. un-suspend).
      delete updateData.ai_trust_score;
      delete updateData.ai_analysis_summary;
      if (req.user.role !== 'admin') {
        delete updateData.status;
      }

      if (req.file) {
        updateData.image_url = `/uploads/campaigns/${req.file.filename}`;
      }

      if (updateData.target_amount) {
        const parsed = parseFloat(updateData.target_amount);
        if (isNaN(parsed) || parsed <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Target amount must be a positive number.'
          });
        }
        updateData.target_amount = parsed;
      }

      if (updateData.category && !VALID_CATEGORIES.includes(updateData.category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}.`
        });
      }

      const updated = CampaignModel.update(campaign.id, updateData);

      return res.status(200).json({
        success: true,
        message: 'Campaign updated successfully.',
        campaign: formatCampaignMetrics(updated)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a campaign with ownership check.
   * DELETE /api/campaigns/:id
   */
  static async deleteCampaign(req, res, next) {
    try {
      const campaign = CampaignModel.findById(req.params.id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found.'
        });
      }

      // Ownership check
      if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to delete this campaign.'
        });
      }

      CampaignModel.delete(campaign.id);

      return res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Retrieves summary of categories with active campaign counts.
   * GET /api/campaigns/categories
   */
  static async getCategories(req, res, next) {
    try {
      const categories = CampaignModel.getCategoriesWithCount();

      return res.status(200).json({
        success: true,
        categories
      });
    } catch (error) {
      next(error);
    }
  }


/**
   * Retrieves campaigns belonging to the authenticated creator.
   * GET /api/campaigns/my
   */
  static async getMyCampaigns(req, res, next) {
    try {
      const campaigns = CampaignModel.findByUserId(req.user.id);

      return res.status(200).json({
        success: true,
        data: campaigns.map(formatCampaignMetrics)
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CampaignController;