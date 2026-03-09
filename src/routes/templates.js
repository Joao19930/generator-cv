// src/routes/templates.js
const express  = require('express');
const router   = express.Router();
const { sql }  = require('../config/database');
const { auth } = require('../middleware/auth');

// Helper: utilizador tem plano pro/premium?
const isPro = (user) => user && ['pro', 'premium'].includes((user.plan || '').toLowerCase());

// ── GET /api/templates ────────────────────────────────────────
// Público — lista todos os templates da BD
// Query params: ?category=&search=&premium=true|false&page=1&limit=50
router.get('/', async (req, res) => {
  try {
    const pool = req.db;
    const { category, search, premium, page = 1, limit = 50 } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let conditionalWhere = '';
    const request = pool.request()
      .input('limit',  sql.Int, parseInt(limit))
      .input('offset', sql.Int, offset);

    if (category) {
      conditionalWhere += ' AND category = @category';
      request.input('category', sql.NVarChar, category);
    }

    if (premium !== undefined) {
      conditionalWhere += ' AND is_premium = @premium';
      request.input('premium', sql.Bit, premium === 'true' ? true : false);
    }

    if (search) {
      conditionalWhere += ' AND name ILIKE @search';
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    const result = await request.query(`
      SELECT id, name, slug, category, is_premium, preview_url, created_at
      FROM templates
      WHERE active = TRUE
      ${conditionalWhere}
      ORDER BY is_premium ASC, sort_order ASC, name ASC
      LIMIT @limit OFFSET @offset
    `);

    const countResult = await pool.request()
      .input('cat2',    sql.NVarChar, category || null)
      .input('prem2',   sql.Bit,      premium !== undefined ? (premium === 'true' ? true : false) : null)
      .input('search2', sql.NVarChar, search ? `%${search}%` : null)
      .query(`
        SELECT COUNT(*) AS total FROM templates
        WHERE active = TRUE
          AND (@cat2    IS NULL OR category   = @cat2)
          AND (@prem2   IS NULL OR is_premium = @prem2)
          AND (@search2 IS NULL OR name       ILIKE @search2)
      `);

    res.json({
      total:     countResult.recordset[0].total,
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
// Público — lista categorias distintas
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
// Público — detalhes + preview_url (visualização livre, sem restrição)
router.get('/:id', async (req, res) => {
  try {
    const result = await req.db.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`
        SELECT id, name, slug, category, is_premium, preview_url, created_at
        FROM templates
        WHERE id = @id AND active = TRUE
      `);

    if (!result.recordset.length)
      return res.status(404).json({ error: 'Template não encontrado.' });

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/templates/start ─────────────────────────────────
// Protegido (JWT) — cria CV com o template escolhido
// Templates premium: bloqueados para utilizadores free
router.post('/start', auth, async (req, res) => {
  try {
    const { templateId, title } = req.body;
    if (!templateId)
      return res.status(400).json({ error: 'templateId é obrigatório.' });

    const pool = req.db;

    const tpl = (await pool.request()
      .input('id', sql.Int, parseInt(templateId))
      .query('SELECT id, name, is_premium FROM templates WHERE id = @id AND active = TRUE'))
      .recordset[0];

    if (!tpl)
      return res.status(404).json({ error: 'Template não encontrado.' });

    // Bloquear templates premium para utilizadores free
    if ((tpl.IsPremium || tpl.is_premium) && !isPro(req.user)) {
      return res.status(403).json({
        error:      'Template premium. Faça upgrade para Pro.',
        upgradeUrl: '/checkout/pro',
      });
    }

    // Criar CV na base de dados (slug único para evitar violação UNIQUE KEY)
    const cvTitle = title || `Meu CV — ${tpl.Name || tpl.name}`;
    const slug = cvTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
    const result = await pool.request()
      .input('userId',     sql.Int,      req.user.id)
      .input('templateId', sql.Int,      parseInt(templateId))
      .input('title',      sql.NVarChar, cvTitle)
      .input('slug',       sql.NVarChar, slug)
      .query(`
        INSERT INTO cvs (user_id, template_id, title, slug, created_at, updated_at)
        VALUES (@userId, @templateId, @title, @slug, NOW(), NOW())
        RETURNING id
      `);

    const cvId = result.recordset[0].Id || result.recordset[0].id;
    res.status(201).json({
      message:    'CV iniciado com sucesso.',
      cvId,
      templateId: parseInt(templateId),
      editorUrl:  `/editor?cv=${cvId}&template=${templateId}`,
    });
  } catch (err) {
    console.error('POST /api/templates/start:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
