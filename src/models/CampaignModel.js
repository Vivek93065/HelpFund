/**
 * src/models/CampaignModel.js
 * 
 * Campaign Data Access Layer using better-sqlite3 Prepared Statements
 * 
 * Architecture & Security:
 * 1. Parameterized Queries: Search keywords and category filters are bound strictly
 *    as parameters, eliminating SQL injection vectors.
 * 2. Relational Joins: Joins with 'users' table to hydrate creator profile data.
 * 3. Dynamic Query Builder: Constructs conditional WHERE clauses safely with bound parameter arrays.
 */

const { db } = require('../config/db');

class CampaignModel {
  /**
   * Creates a new campaign record.
   */
  static create({
    user_id,
    title,
    category,
    short_description,
    story_content,
    target_amount,
    deadline,
    image_url = null,
    ai_trust_score = null,
    ai_analysis_summary = null,
    status = 'active'
  }) {
    const stmt = db.prepare(`
      INSERT INTO campaigns (
        user_id, title, category, short_description, story_content,
        target_amount, deadline, image_url, ai_trust_score, ai_analysis_summary, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      user_id,
      title.trim(),
      category.trim(),
      short_description.trim(),
      story_content.trim(),
      Number(target_amount),
      deadline,
      image_url,
      ai_trust_score,
      ai_analysis_summary,
      status
    );

    return this.findById(Number(result.lastInsertRowid));
  }

  /**
   * Finds a campaign by ID, joining the creator's user information.
   */
  static findById(id) {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        u.full_name AS creator_name,
        u.email AS creator_email,
        u.avatar_url AS creator_avatar,
        u.bio AS creator_bio
      FROM campaigns c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `);
    return stmt.get(Number(id));
  }

  /**
   * Searches and filters campaigns with pagination and sorting.
   */
  static findAll({
    category,
    search,
    status = 'active',
    sort = 'newest',
    page = 1,
    limit = 12
  } = {}) {
    let whereClauses = ['1=1'];
    let params = [];

    if (status && status !== 'all') {
      whereClauses.push('c.status = ?');
      params.push(status);
    }

    if (category && category.toLowerCase() !== 'all') {
      whereClauses.push('c.category = ?');
      params.push(category);
    }

    if (search && search.trim()) {
      whereClauses.push('(c.title LIKE ? OR c.short_description LIKE ?)');
      const wildcard = `%${search.trim()}%`;
      params.push(wildcard, wildcard);
    }

    // Determine sorting order
    let orderBy = 'c.created_at DESC';
    if (sort === 'most_funded') {
      orderBy = 'c.raised_amount DESC';
    } else if (sort === 'urgent') {
      orderBy = 'c.deadline ASC';
    } else if (sort === 'target') {
      orderBy = 'c.target_amount DESC';
    } else if (sort === 'trust' || sort === 'highest_trust') {
      orderBy = 'c.ai_trust_score DESC';
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. Get total matching count
    const countStmt = db.prepare(`
      SELECT COUNT(*) AS total
      FROM campaigns c
      WHERE ${whereSql}
    `);
    const total = countStmt.get(...params).total;

    // 2. Fetch paginated records
    const offset = (Math.max(1, page) - 1) * limit;
    const selectStmt = db.prepare(`
      SELECT 
        c.*,
        u.full_name AS creator_name,
        u.avatar_url AS creator_avatar
      FROM campaigns c
      JOIN users u ON c.user_id = u.id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);

    const campaigns = selectStmt.all(...params, limit, offset);

    return {
      campaigns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Updates an existing campaign.
   */
  static update(id, updateData = {}) {
    const allowedFields = [
      'title',
      'category',
      'short_description',
      'story_content',
      'target_amount',
      'deadline',
      'image_url',
      'status',
      'ai_trust_score',
      'ai_analysis_summary'
    ];

    const fieldsToUpdate = [];
    const params = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fieldsToUpdate.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fieldsToUpdate.length === 0) {
      return this.findById(id);
    }

    fieldsToUpdate.push('updated_at = CURRENT_TIMESTAMP');
    params.push(Number(id));

    const stmt = db.prepare(`
      UPDATE campaigns
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);
    return this.findById(id);
  }

  /**
   * Atomically increments a campaign's raised amount upon successful donation.
   */
  static updateRaisedAmount(id, additionalAmount) {
    const stmt = db.prepare(`
      UPDATE campaigns
      SET raised_amount = raised_amount + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(Number(additionalAmount), Number(id));
    return this.findById(id);
  }

  /**
   * Deletes a campaign by ID.
   */
  static delete(id) {
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
    return stmt.run(Number(id));
  }

  /**
   * Retrieves summary of active campaigns grouped by category.
   */
  static getCategoriesWithCount() {
    const stmt = db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM campaigns
      WHERE status = 'active'
      GROUP BY category
      ORDER BY count DESC
    `);
    return stmt.all();
  }

  /**
   * Retrieves campaigns created by a specific user.
   */
  static findByUserId(userId) {
    const stmt = db.prepare(`
      SELECT * FROM campaigns
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(Number(userId));
  }

  /**
   * Adds a milestone progress update to a campaign.
   */
  static addUpdate(campaignId, title, updateText) {
    const stmt = db.prepare(`
      INSERT INTO campaign_updates (campaign_id, title, update_text)
      VALUES (?, ?, ?)
    `);
    const res = stmt.run(Number(campaignId), title.trim(), updateText.trim());
    return {
      id: Number(res.lastInsertRowid),
      campaign_id: Number(campaignId),
      title: title.trim(),
      update_text: updateText.trim(),
      created_at: new Date().toISOString()
    };
  }

  /**
   * Retrieves all progress updates for a campaign.
   */
  static getUpdates(campaignId) {
    const stmt = db.prepare(`
      SELECT * FROM campaign_updates
      WHERE campaign_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(Number(campaignId));
  }
}

module.exports = CampaignModel;
