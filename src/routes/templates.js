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

    let where = 'WHERE Active = 1';
    const request = pool.request()
      .input('limit',  sql.Int, parseInt(limit))
      .input('offset', sql.Int, offset);

    if (category) {
      where += ' AND Category = @category';
      request.input('category', sql.NVarChar, category);
    }

    if (premium !== undefined) {
      where += ' AND IsPremium = @premium';
      request.input('premium', sql.Bit, premium === 'true' ? 1 : 0);
    }

    if (search) {
      where += ' AND Name LIKE @search';
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    const result = await request.query(`
      SELECT Id, Name, Slug, Category, IsPremium, PreviewUrl, CreatedAt
      FROM Templates
      ${where}
      ORDER BY IsPremium ASC, SortOrder ASC, Name ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const countResult = await pool.request()
      .input('cat2',    sql.NVarChar, category || null)
      .input('prem2',   sql.Bit,      premium !== undefined ? (premium === 'true' ? 1 : 0) : null)
      .input('search2', sql.NVarChar, search ? `%${search}%` : null)
      .query(`
        SELECT COUNT(*) AS total FROM Templates
        WHERE Active = 1
          AND (@cat2    IS NULL OR Category  = @cat2)
          AND (@prem2   IS NULL OR IsPremium = @prem2)
          AND (@search2 IS NULL OR Name      LIKE @search2)
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
      'SELECT DISTINCT Category FROM Templates WHERE Active = 1 AND Category IS NOT NULL ORDER BY Category'
    );
    res.json(result.recordset.map(r => r.Category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/templates/:id ────────────────────────────────────
// Público — detalhes + PreviewUrl (visualização livre, sem restrição)
router.get('/:id', async (req, res) => {
  try {
    const result = await req.db.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`
        SELECT Id, Name, Slug, Category, IsPremium, PreviewUrl, CreatedAt
        FROM Templates
        WHERE Id = @id AND Active = 1
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
      .query('SELECT Id, Name, IsPremium FROM Templates WHERE Id = @id AND Active = 1'))
      .recordset[0];

    if (!tpl)
      return res.status(404).json({ error: 'Template não encontrado.' });

    // Bloquear templates premium para utilizadores free
    if (tpl.IsPremium && !isPro(req.user)) {
      return res.status(403).json({
        error:      'Template premium. Faça upgrade para Pro.',
        upgradeUrl: '/checkout/pro',
      });
    }

    // Criar CV na base de dados (slug único para evitar violação UNIQUE KEY)
    const cvTitle = title || `Meu CV — ${tpl.Name}`;
    const slug = cvTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
    const result = await pool.request()
      .input('userId',     sql.Int,      req.user.id)
      .input('templateId', sql.Int,      parseInt(templateId))
      .input('title',      sql.NVarChar, cvTitle)
      .input('slug',       sql.NVarChar, slug)
      .query(`
        INSERT INTO CVs (UserId, TemplateId, Title, Slug, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.Id
        VALUES (@userId, @templateId, @title, @slug, GETDATE(), GETDATE())
      `);

    const cvId = result.recordset[0].Id;
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
