/**
 * src/models/DonationModel.js
 * 
 * Donation Data Access Layer & Atomic Transaction Engine
 * 
 * Key Architecture & Viva Points:
 * 1. Financial ACID Atomicity: All successful donation records and campaign balance
 *    increments are executed inside a single SQLite transaction (db.transaction()).
 *    If either step fails (e.g. duplicate transaction ID, invalid campaign), the entire
 *    transaction rolls back automatically with zero state corruption.
 * 2. Idempotency & Duplicate Protection: Checks for existing paypal_order_id and
 *    paypal_capture_id to completely eliminate double-crediting attacks.
 * 3. Privacy Masking: When querying campaign donations, anonymous donations (is_anonymous=1)
 *    automatically mask donor_name as 'Anonymous Donor' and strip donor_email.
 */

const { db } = require('../config/db');

class DonationModel {
  /**
   * Finds a donation by PayPal Order ID.
   */
  static findByOrderId(orderId) {
    const stmt = db.prepare('SELECT * FROM donations WHERE paypal_order_id = ?');
    return stmt.get(orderId);
  }

  /**
   * Finds a donation by PayPal Capture ID.
   */
  static findByCaptureId(captureId) {
    const stmt = db.prepare('SELECT * FROM donations WHERE paypal_capture_id = ?');
    return stmt.get(captureId);
  }

  /**
   * Atomically records a verified donation and increments the campaign's raised amount.
   * 
   * @param {object} donationData
   * @returns {object} { donation, updatedCampaign }
   */
  static recordVerifiedDonationAtomic({
    campaign_id,
    user_id = null,
    donor_name,
    donor_email,
    amount,
    currency = 'USD',
    paypal_order_id,
    paypal_capture_id,
    payment_status = 'COMPLETED',
    donor_message = null,
    is_anonymous = 0
  }) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Donation amount must be greater than zero.');
    }

    // Execute atomic transaction
    const executeTransaction = db.transaction(() => {
      // 1. Idempotency Check: Prevent duplicate order recording
      const existingOrder = db.prepare('SELECT id FROM donations WHERE paypal_order_id = ?').get(paypal_order_id);
      if (existingOrder) {
        const err = new Error('This PayPal order has already been recorded.');
        err.code = 'DUPLICATE_ORDER';
        throw err;
      }

      // 2. Idempotency Check: Prevent duplicate capture recording
      if (paypal_capture_id) {
        const existingCapture = db.prepare('SELECT id FROM donations WHERE paypal_capture_id = ?').get(paypal_capture_id);
        if (existingCapture) {
          const err = new Error('This PayPal capture ID has already been credited.');
          err.code = 'DUPLICATE_CAPTURE';
          throw err;
        }
      }

      // 3. Verify Campaign Exists and is Active
      const campaign = db.prepare('SELECT id, title, target_amount, raised_amount, status FROM campaigns WHERE id = ?').get(Number(campaign_id));
      if (!campaign) {
        const err = new Error('Campaign not found.');
        err.code = 'CAMPAIGN_NOT_FOUND';
        throw err;
      }

      if (campaign.status === 'suspended') {
        const err = new Error('Cannot donate to a suspended campaign.');
        err.code = 'CAMPAIGN_SUSPENDED';
        throw err;
      }

      // 4. Insert Verified Donation Record
      const insertStmt = db.prepare(`
        INSERT INTO donations (
          campaign_id, user_id, donor_name, donor_email, amount,
          currency, paypal_order_id, paypal_capture_id, payment_status,
          donor_message, is_anonymous
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertResult = insertStmt.run(
        Number(campaign_id),
        user_id ? Number(user_id) : null,
        donor_name.trim(),
        donor_email.trim().toLowerCase(),
        parsedAmount,
        currency.toUpperCase(),
        paypal_order_id,
        paypal_capture_id,
        payment_status,
        donor_message ? donor_message.trim() : null,
        is_anonymous ? 1 : 0
      );

      // 5. Atomically Increment Campaign Raised Amount
      const updateStmt = db.prepare(`
        UPDATE campaigns
        SET raised_amount = raised_amount + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(parsedAmount, Number(campaign_id));

      // 6. Retrieve updated campaign totals
      const updatedCampaign = db.prepare('SELECT id, title, target_amount, raised_amount, status FROM campaigns WHERE id = ?').get(Number(campaign_id));

      const donation = {
        id: Number(insertResult.lastInsertRowid),
        campaign_id: Number(campaign_id),
        amount: parsedAmount,
        currency: currency.toUpperCase(),
        paypal_order_id,
        paypal_capture_id,
        payment_status,
        donor_name: is_anonymous ? 'Anonymous Donor' : donor_name.trim(),
        is_anonymous: is_anonymous ? 1 : 0,
        donor_message
      };

      return { donation, updatedCampaign };
    });

    return executeTransaction();
  }

  /**
   * Retrieves public donations for a campaign with privacy masking.
   */
  static findByCampaignId(campaignId, { limit = 20, offset = 0 } = {}) {
    const stmt = db.prepare(`
      SELECT 
        id,
        campaign_id,
        amount,
        currency,
        payment_status,
        donor_message,
        is_anonymous,
        created_at,
        CASE WHEN is_anonymous = 1 THEN 'Anonymous Donor' ELSE donor_name END AS donor_name
      FROM donations
      WHERE campaign_id = ? AND payment_status = 'COMPLETED'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(Number(campaignId), limit, offset);
  }

  /**
   * Retrieves past donations made by an authenticated user.
   */
  static findByUserId(userId) {
    const stmt = db.prepare(`
      SELECT 
        d.*,
        c.title AS campaign_title,
        c.category AS campaign_category,
        c.image_url AS campaign_image
      FROM donations d
      JOIN campaigns c ON d.campaign_id = c.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `);
    return stmt.all(Number(userId));
  }

  /**
   * Returns donor metrics for a campaign.
   */
  static getMetrics(campaignId) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) AS total_donations,
        COUNT(DISTINCT donor_email) AS unique_donors,
        COALESCE(SUM(amount), 0.0) AS total_amount
      FROM donations
      WHERE campaign_id = ? AND payment_status = 'COMPLETED'
    `);
    return stmt.get(Number(campaignId));
  }
}

module.exports = DonationModel;
