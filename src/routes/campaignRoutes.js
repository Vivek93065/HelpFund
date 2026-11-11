/**
 * src/routes/campaignRoutes.js
 * 
 * Express Router for Campaign Management
 * 
 * Public Routes:
 * - GET  /api/campaigns            : Paginated list with search, filter, and sorting
 * - GET  /api/campaigns/categories : Summary of categories with active campaign counts
 * - GET  /api/campaigns/:id        : Single campaign details with creator info & metrics
 * 
 * Protected Routes:
 * - POST   /api/campaigns          : Create new campaign (Creator or Admin role + optional banner upload)
 * - PUT    /api/campaigns/:id      : Update campaign (Owner or Admin role + optional banner upload)
 * - DELETE /api/campaigns/:id      : Delete campaign (Owner or Admin role)
 */

const express = require('express');
const router = express.Router();
const CampaignController = require('../controllers/campaignController');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public listing and exploration
router.get('/', CampaignController.getCampaigns);
router.get('/categories', CampaignController.getCategories);
// Creator's own campaigns
router.get(
  '/my',
  authenticate,
  requireRole('creator', 'admin'),
  CampaignController.getMyCampaigns
);
router.get('/:id', CampaignController.getCampaignById);

// Public: Campaign Updates
router.get('/:id/updates', CampaignController.getCampaignUpdates);

// Protected: Post Campaign Update
router.post(
  '/:id/updates',
  authenticate,
  requireRole('creator', 'admin'),
  CampaignController.addCampaignUpdate
);

// Protected: Campaign Creation (requires Creator or Admin role)
router.post(
  '/',
  authenticate,
  requireRole('creator', 'admin'),
  upload.single('banner_image'),
  CampaignController.createCampaign
);

// Protected: Update Campaign (requires Owner or Admin)
router.put(
  '/:id',
  authenticate,
  upload.single('banner_image'),
  CampaignController.updateCampaign
);

// Protected: Delete Campaign (requires Owner or Admin)
router.delete(
  '/:id',
  authenticate,
  CampaignController.deleteCampaign
);

module.exports = router;
