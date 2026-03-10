// src/routes/templates.js
const express  = require('express');
const router   = express.Router();
const { sql }  = require('../config/database');
const { auth } = require('../middleware/auth');

const isPro = (user) => user && ['pro', 'premium'].includes((user.plan || '').toLowerCase());

// ── GET /api/templates ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const pool = req.db;
    const { category, search, premium, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const request = pool.request()
      .input('lim',    sql.Int, parseInt(limit))
      .input('offset', sql.Int, offset);

    let where = '';
    if (category) { where += ' AND category = @category'; request.input('category', sql.NVarChar, category); }
    if (premium !== undefined) { where += ' AND is_premium = @premium'; request.input('premium', sql.Bit, premium === 'true'); }
    if (search) { where += ' AND name ILIKE @search'; request.input('search', sql.NVarChar, `%${search}%`); }

    const result = await request.query(`
      SELECT id, name, slug, category, is_premium, preview_url, created_at
      FROM templates WHERE active = TRUE ${where}
      ORDER BY is_premium ASC, sort_order ASC, name ASC
      LIMIT @lim OFFSET @offset
    `);

    const countReq = pool.request();
    if (category) countReq.input('category', sql.NVarChar, category);
    if (premium !== undefined) countReq.input('premium', sql.Bit, premium === 'true');
    if (search) countReq.input('search', sql.NVarChar, `%${search}%`);
    const countResult = await countReq.query(
      `SELECT COUNT(*) AS total FROM templates WHERE active = TRUE ${where}`
    );

    res.json({
      total:     parseInt(countResult.recordset[0].total || countResult.recordset[0].Total || 0),
      page:      parseInt(page),
      limit:     parseInt(limit),
      templates: result.recordset,
    });
  } catch (err) {
    console.error('GET /api/templates:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/templates/categories ────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const result = await req.db.request().query(
      'SELECT DISTINCT category FROM templates WHERE active = TRUE AND category IS NOT NULL ORDER BY category'
    );
    res.json(result.recordset.map(r => r.Category || r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/templates/:id ────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await req.db.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT id, name, slug, category, is_premium, preview_url, created_at FROM templates WHERE id = @id AND active = TRUE');
    if (!result.recordset.length)
      return res.status(404).json({ error: 'Template não encontrado.' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/templates/start ─────────────────────────────────
router.post('/start', auth, async (req, res) => {
  try {
    const { templateId, title } = req.body;
    if (!templateId) return res.status(400).json({ error: 'templateId é obrigatório.' });

    const pool = req.db;
    const tpl = (await pool.request()
      .input('id', sql.Int, parseInt(templateId))
      .query('SELECT id, name, is_premium FROM templates WHERE id = @id AND active = TRUE'))
      .recordset[0];

    if (!tpl) return res.status(404).json({ error: 'Template não encontrado.' });
    if ((tpl.IsPremium || tpl.is_premium) && !isPro(req.user)) {
      return res.status(403).json({ error: 'Template premium. Faça upgrade para Pro.', upgradeUrl: '/checkout/pro' });
    }

    const cvTitle = title || `Meu CV — ${tpl.Name || tpl.name}`;
    const slug = cvTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
    const result = await pool.request()
      .input('userId',     sql.Int,      req.user.id)
      .input('templateId', sql.Int,      parseInt(templateId))
      .input('title',      sql.NVarChar, cvTitle)
      .input('slug',       sql.NVarChar, slug)
      .query(`INSERT INTO cvs (user_id, template_id, title, slug, created_at, updated_at)
              VALUES (@userId, @templateId, @title, @slug, NOW(), NOW()) RETURNING id`);

    const cvId = result.recordset[0].Id || result.recordset[0].id;
    res.status(201).json({ message: 'CV iniciado com sucesso.', cvId, templateId: parseInt(templateId), editorUrl: `/editor?cv=${cvId}&template=${templateId}` });
  } catch (err) {
    console.error('POST /api/templates/start:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
