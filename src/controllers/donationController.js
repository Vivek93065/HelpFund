/**
 * src/controllers/donationController.js
 * 
 * PayPal Sandbox Donation Controller
 * 
 * Flow & Security Guarantees:
 * 1. Step 1 (Create Order): User specifies amount -> Backend verifies campaign status and creates
 *    PayPal order via PayPal REST API -> Returns orderID to frontend.
 * 2. Step 2 (Capture & Verify): After user approves in PayPal popup, frontend sends orderID to backend ->
 *    Backend contacts PayPal directly to capture payment and inspects the verified capture status and amount.
 * 3. Never Trust Client Amounts: The database is updated exclusively using the captured amount reported
 *    directly by PayPal's API, never client-submitted values.
 * 4. Atomic Execution: Balance update and donation ledger record are committed in a single atomic transaction.
 */

const PayPalService = require('../services/paypalService');
const DonationModel = require('../models/DonationModel');
const CampaignModel = require('../models/CampaignModel');
const { validateEmail, validateName } = require('../utils/validators');

const MIN_DONATION_AMOUNT = 1.0;
const MAX_DONATION_AMOUNT = 50000.0;

class DonationController {
  /**
   * Creates a PayPal checkout order for a campaign donation.
   * POST /api/donations/create-order
   */
  static async createOrder(req, res, next) {
    try {
      const { campaign_id, amount, donor_message, is_anonymous } = req.body;

      // 1. Validate Campaign
      if (!campaign_id) {
        return res.status(400).json({
          success: false,
          error: 'Campaign ID is required.'
        });
      }

      const campaign = CampaignModel.findById(campaign_id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found.'
        });
      }

      if (campaign.status === 'suspended') {
        return res.status(400).json({
          success: false,
          error: 'Cannot donate to a suspended campaign.'
        });
      }

      // Check if campaign is past deadline
      const deadlineDate = new Date(campaign.deadline);
      // Give till end of deadline day
      deadlineDate.setHours(23, 59, 59, 999);
      if (deadlineDate.getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          error: 'This campaign funding deadline has concluded.'
        });
      }

      // 2. Validate Donation Amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < MIN_DONATION_AMOUNT) {
        return res.status(400).json({
          success: false,
          error: `Minimum donation amount is $${MIN_DONATION_AMOUNT.toFixed(2)} USD.`
        });
      }

      if (parsedAmount > MAX_DONATION_AMOUNT) {
        return res.status(400).json({
          success: false,
          error: `Maximum single donation amount is $${MAX_DONATION_AMOUNT.toLocaleString()} USD.`
        });
      }

      // 3. Create PayPal Order via Service
      const donorEmail = req.user ? req.user.email : req.body.donor_email;
      const order = await PayPalService.createOrder({
        amount: parsedAmount,
        currency: 'USD',
        campaignId: campaign.id,
        donorEmail,
        description: `HelpFund: ${campaign.title.substring(0, 80)}`
      });

      return res.status(201).json({
        success: true,
        orderID: order.id,
        status: order.status,
        amount: order.amount,
        currency: order.currency
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Captures an approved PayPal order and commits the verified donation.
   * POST /api/donations/capture-order
   */
  static async captureOrder(req, res, next) {
    try {
      const { orderID, campaign_id, donor_message, is_anonymous } = req.body;

      if (!orderID || typeof orderID !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Valid PayPal orderID is required.'
        });
      }

      if (!campaign_id) {
        return res.status(400).json({
          success: false,
          error: 'Campaign ID is required.'
        });
      }

      const campaign = CampaignModel.findById(campaign_id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found.'
        });
      }

      // 1. Capture Payment directly from PayPal Server
      let captureResult;
      try {
        captureResult = await PayPalService.captureOrder(orderID);
      } catch (paypalErr) {
        return res.status(paypalErr.status || 400).json({
          success: false,
          error: paypalErr.message || 'Payment capture failed.'
        });
      }

      // 2. Strict Verification of Captured Payment Details
      if (captureResult.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          error: `Payment capture incomplete. PayPal status: ${captureResult.status}`
        });
      }

      if (captureResult.currency !== 'USD') {
        return res.status(400).json({
          success: false,
          error: `Payment currency mismatch. Expected USD, got ${captureResult.currency}`
        });
      }

      // If the PayPal order was bound to a specific campaignId, ensure it matches
      if (captureResult.campaignId && String(captureResult.campaignId) !== String(campaign_id)) {
        return res.status(400).json({
          success: false,
          error: 'Payment order does not belong to this campaign.'
        });
      }

      const verifiedAmount = parseFloat(captureResult.amount);
      if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment amount reported by PayPal.'
        });
      }

      // 3. Determine Donor Identity
      const donor_name = req.user ? req.user.full_name : (req.body.donor_name || 'Kind Donor');
      const donor_email = req.user ? req.user.email : (req.body.donor_email || 'donor@helpfund.org');
      const user_id = req.user ? req.user.id : null;

      // 4. Atomic Database Transaction: Record Donation & Increment Campaign Balance
      let transactionResult;
      try {
        transactionResult = DonationModel.recordVerifiedDonationAtomic({
          campaign_id: Number(campaign_id),
          user_id,
          donor_name,
          donor_email,
          amount: verifiedAmount, // Crucial: verified amount from PayPal, NOT user input!
          currency: captureResult.currency,
          paypal_order_id: captureResult.orderId,
          paypal_capture_id: captureResult.captureId,
          payment_status: 'COMPLETED',
          donor_message: typeof donor_message === 'string' ? donor_message.trim() : null,
          is_anonymous: Boolean(is_anonymous) ? 1 : 0
        });
      } catch (dbErr) {
        if (dbErr.code === 'DUPLICATE_ORDER' || dbErr.code === 'DUPLICATE_CAPTURE') {
          return res.status(409).json({
            success: false,
            error: 'This donation transaction has already been captured and processed.'
          });
        }
        throw dbErr;
      }

      return res.status(200).json({
        success: true,
        message: 'Donation verified and processed successfully. Thank you for your support!',
        receipt: {
          donation_id: transactionResult.donation.id,
          order_id: captureResult.orderId,
          capture_id: captureResult.captureId,
          amount: verifiedAmount,
          currency: captureResult.currency,
          donor_name: transactionResult.donation.donor_name,
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          new_raised_amount: transactionResult.updatedCampaign.raised_amount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves public donation ledger for a campaign.
   * GET /api/donations/campaign/:campaignId
   */
  static async getCampaignDonations(req, res, next) {
    try {
      const { campaignId } = req.params;
      const { page = 1, limit = 15 } = req.query;

      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const donations = DonationModel.findByCampaignId(campaignId, {
        limit: parseInt(limit, 10),
        offset
      });

      const metrics = DonationModel.getMetrics(campaignId);

      return res.status(200).json({
        success: true,
        data: donations,
        metrics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns public client-safe PayPal SDK configuration.
   * GET /api/donations/config
   */
  static getClientConfig(req, res) {
    const configData = PayPalService.getClientConfig();
    return res.status(200).json({
      success: true,
      config: configData
    });
  }


  /**
   * Retrieves donation history for the authenticated user.
   * GET /api/donations/my
   */
  static async getMyDonations(req, res, next) {
    try {
      const donations = DonationModel.findByUserId(req.user.id);

      return res.status(200).json({
        success: true,
        data: donations
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = DonationController;
