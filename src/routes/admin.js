// src/routes/admin.js
// ─────────────────────────────────────────────────────────────
// Dashboard Admin — KPIs, utilizadores, receita, funil
// Todas as rotas requerem: auth + adminOnly
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { sql } = require('../config/database');
const { redisConnector } = require('../connectors');

// ── GET /api/admin/overview ──────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const cached = await redisConnector.get('admin:overview');
    if (cached) return res.json(cached);

    const r = await req.db.request().query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
        (SELECT COUNT(*) FROM users WHERE plan = 'premium') AS premium_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 day') AS new_today,
        (SELECT COUNT(*) FROM cvs) AS total_cvs,
        (SELECT COUNT(*) FROM cvs WHERE created_at >= NOW() - INTERVAL '1 day') AS cvs_today,
        (SELECT COUNT(*) FROM cvs WHERE created_at >= NOW() - INTERVAL '7 days') AS cvs_7d,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid') AS total_revenue,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid' AND created_at >= NOW() - INTERVAL '30 days') AS revenue_30d,
        (SELECT COUNT(*) FROM payments WHERE status='paid' AND created_at >= NOW() - INTERVAL '30 days') AS paid_30d,
        (SELECT COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'),0)*100
         FROM payments WHERE status='paid' AND created_at >= NOW() - INTERVAL '30 days') AS conversion_rate
    `);
    const data = r.recordset[0];
    await redisConnector.set('admin:overview', data, 300);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/users ─────────────────────────────────────
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20, search = '', plan = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const r = await req.db.request()
      .input('s',      sql.NVarChar, `%${search}%`)
      .input('plan',   sql.NVarChar, plan)
      .input('offset', sql.Int, offset)
      .input('limit',  sql.Int, Number(limit))
      .query(`
        SELECT u.id, u.name, u.email, u.plan, u.role, u.is_active, u.created_at, u.last_login,
               COUNT(DISTINCT c.id) AS cv_count,
               COALESCE(SUM(p.amount),0) AS total_spent
        FROM users u
        LEFT JOIN cvs c      ON c.user_id = u.id
        LEFT JOIN payments p ON p.user_id = u.id AND p.status = 'paid'
        WHERE (u.name ILIKE @s OR u.email ILIKE @s) AND (@plan='' OR u.plan=@plan)
        GROUP BY u.id, u.name, u.email, u.plan, u.role, u.is_active, u.created_at, u.last_login
        ORDER BY u.created_at DESC
        LIMIT @limit OFFSET @offset
      `);
    const total = (await req.db.request().input('s', sql.NVarChar, `%${search}%`).input('plan', sql.NVarChar, plan)
      .query(`SELECT COUNT(*) AS n FROM users WHERE (name ILIKE @s OR email ILIKE @s) AND (@plan='' OR plan=@plan)`)).recordset[0].n;
    res.json({ users: r.recordset, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/revenue/chart ─────────────────────────────
router.get('/revenue/chart', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT created_at::date AS date, SUM(amount) AS revenue, COUNT(*) AS tx
      FROM payments WHERE status='paid' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY created_at::date ORDER BY date ASC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/growth ────────────────────────────────────
router.get('/growth', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
             COUNT(*) AS new_users,
             COUNT(CASE WHEN plan='premium' THEN 1 END) AS new_premium
      FROM users WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month ASC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/funnel ────────────────────────────────────
router.get('/funnel', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS registered,
        (SELECT COUNT(DISTINCT user_id) FROM cvs) AS created_cv,
        (SELECT COUNT(DISTINCT user_id) FROM cvs WHERE downloaded=TRUE) AS downloaded_cv,
        (SELECT COUNT(DISTINCT user_id) FROM payments WHERE status='paid') AS paid
    `);
    const d = r.recordset[0];
    const base = d.registered || 1;
    res.json([
      { step: '1. Registados',        count: d.registered,    pct: 100 },
      { step: '2. Criaram CV',        count: d.created_cv,    pct: +((d.created_cv/base)*100).toFixed(1) },
      { step: '3. Fizeram Download',  count: d.downloaded_cv, pct: +((d.downloaded_cv/base)*100).toFixed(1) },
      { step: '4. Compraram Premium', count: d.paid,          pct: +((d.paid/base)*100).toFixed(1) }
    ]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/templates ─────────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT template_id, template_name, COUNT(*) AS uses,
             COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS uses_7d
      FROM cvs GROUP BY template_id, template_name ORDER BY uses DESC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/payments ──────────────────────────────────
router.get('/payments', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page)-1)*Number(limit);
  try {
    const r = await req.db.request()
      .input('offset', sql.Int, offset).input('limit', sql.Int, Number(limit))
      .query(`
        SELECT p.id, p.amount, p.currency, p.status, p.method, p.created_at, p.stripe_session_id,
               u.name AS user_name, u.email AS user_email
        FROM payments p INNER JOIN users u ON u.id=p.user_id
        ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset
      `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:id/ban ────────────────────────────
router.post('/users/:id/ban', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).input('by', sql.Int, req.user.id)
      .query('UPDATE users SET is_active=FALSE, banned_at=NOW(), banned_by=@by WHERE id=@id');
    await redisConnector.del(`admin:overview`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:id/upgrade ────────────────────────
router.post('/users/:id/upgrade', async (req, res) => {
  const { plan = 'premium', days = 30 } = req.body;
  try {
    const expiry = new Date(Date.now() + days * 86400000);
    await req.db.request().input('id', sql.Int, req.params.id).input('plan', sql.NVarChar, plan).input('exp', sql.DateTime, expiry)
      .query('UPDATE users SET plan=@plan, plan_expiry=@exp WHERE id=@id');
    await redisConnector.del('admin:overview');
    res.json({ success: true, plan, expiry });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COACHES CRUD ─────────────────────────────────────────────
router.get('/coaches', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM coaches ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/coaches', async (req, res) => {
  const { name, location, bio, skills, email, color, photoUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
  try {
    const r = await req.db.request()
      .input('name',     sql.NVarChar, name)
      .input('location', sql.NVarChar, location||null)
      .input('bio',      sql.NVarChar, bio||null)
      .input('skills',   sql.NVarChar, skills||null)
      .input('email',    sql.NVarChar, email||null)
      .input('color',    sql.NVarChar, color||'#6366f1')
      .input('photo',    sql.NVarChar, photoUrl||null)
      .query(`INSERT INTO coaches (name, location, bio, skills, email, color, photo_url, active, created_at)
              VALUES (@name, @location, @bio, @skills, @email, @color, @photo, TRUE, NOW()) RETURNING id`);
    res.json({ success: true, id: r.recordset[0].Id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/coaches/:id', async (req, res) => {
  const { name, location, bio, skills, email, color, photoUrl } = req.body;
  try {
    await req.db.request()
      .input('id',       sql.Int,      req.params.id)
      .input('name',     sql.NVarChar, name)
      .input('location', sql.NVarChar, location||null)
      .input('bio',      sql.NVarChar, bio||null)
      .input('skills',   sql.NVarChar, skills||null)
      .input('email',    sql.NVarChar, email||null)
      .input('color',    sql.NVarChar, color||'#6366f1')
      .input('photo',    sql.NVarChar, photoUrl||null)
      .query('UPDATE coaches SET name=@name, location=@location, bio=@bio, skills=@skills, email=@email, color=@color, photo_url=@photo WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/coaches/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM coaches WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── COURSES CRUD ──────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM courses ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/courses', async (req, res) => {
  const { title, source, category, rating, url } = req.body;
  if (!title) return res.status(400).json({ error: 'Título obrigatório.' });
  try {
    const r = await req.db.request()
      .input('title',    sql.NVarChar, title)
      .input('source',   sql.NVarChar, source||null)
      .input('category', sql.NVarChar, category||null)
      .input('rating',   sql.NVarChar, rating||null)
      .input('url',      sql.NVarChar, url||null)
      .query(`INSERT INTO courses (title, source, category, rating, url, active, created_at)
              VALUES (@title, @source, @category, @rating, @url, TRUE, NOW()) RETURNING id`);
    res.json({ success: true, id: r.recordset[0].Id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/courses/:id', async (req, res) => {
  const { title, source, category, rating, url } = req.body;
  try {
    await req.db.request()
      .input('id',       sql.Int,      req.params.id)
      .input('title',    sql.NVarChar, title)
      .input('source',   sql.NVarChar, source||null)
      .input('category', sql.NVarChar, category||null)
      .input('rating',   sql.NVarChar, rating||null)
      .input('url',      sql.NVarChar, url||null)
      .query('UPDATE courses SET title=@title, source=@source, category=@category, rating=@rating, url=@url WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/courses/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM courses WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── JOBS CRUD ─────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/jobs', async (req, res) => {
  const { title, company, city, country, category, date, jobDate, startDate, endDate, url, contactType } = req.body;
  if (!title) return res.status(400).json({ error: 'Título obrigatório.' });
  const d = jobDate || date || null;
  try {
    const r = await req.db.request()
      .input('title',       sql.NVarChar, title)
      .input('company',     sql.NVarChar, company||null)
      .input('city',        sql.NVarChar, city||null)
      .input('country',     sql.NVarChar, country||null)
      .input('cat',         sql.NVarChar, category||null)
      .input('date',        sql.Date,     d ? new Date(d) : null)
      .input('startDate',   sql.Date,     startDate ? new Date(startDate) : null)
      .input('endDate',     sql.Date,     endDate   ? new Date(endDate)   : null)
      .input('url',         sql.NVarChar, url||null)
      .input('contactType', sql.NVarChar, contactType||'url')
      .query(`INSERT INTO jobs (title, company, city, country, category, job_date, start_date, end_date, url, contact_type, active, created_at)
              VALUES (@title, @company, @city, @country, @cat, @date, @startDate, @endDate, @url, @contactType, TRUE, NOW()) RETURNING id`);
    res.json({ success: true, id: r.recordset[0].Id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/jobs/:id', async (req, res) => {
  const { title, company, city, country, category, date, jobDate, startDate, endDate, url, contactType } = req.body;
  const d = jobDate || date || null;
  try {
    await req.db.request()
      .input('id',          sql.Int,      req.params.id)
      .input('title',       sql.NVarChar, title)
      .input('company',     sql.NVarChar, company||null)
      .input('city',        sql.NVarChar, city||null)
      .input('country',     sql.NVarChar, country||null)
      .input('cat',         sql.NVarChar, category||null)
      .input('date',        sql.Date,     d ? new Date(d) : null)
      .input('startDate',   sql.Date,     startDate ? new Date(startDate) : null)
      .input('endDate',     sql.Date,     endDate   ? new Date(endDate)   : null)
      .input('url',         sql.NVarChar, url||null)
      .input('contactType', sql.NVarChar, contactType||'url')
      .query('UPDATE jobs SET title=@title, company=@company, city=@city, country=@country, category=@cat, job_date=@date, start_date=@startDate, end_date=@endDate, url=@url, contact_type=@contactType WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/jobs/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM jobs WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TESTIMONIALS CRUD ─────────────────────────────────────────
router.get('/testimonials', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM testimonials ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/testimonials', async (req, res) => {
  const { name, role, text, stars } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
  try {
    const r = await req.db.request()
      .input('name',  sql.NVarChar, name)
      .input('role',  sql.NVarChar, role||null)
      .input('text',  sql.NVarChar, text||null)
      .input('stars', sql.Int,      parseInt(stars)||5)
      .query(`INSERT INTO testimonials (name, role, text, stars, active, created_at)
              VALUES (@name, @role, @text, @stars, TRUE, NOW()) RETURNING id`);
    res.json({ success: true, id: r.recordset[0].Id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/testimonials/:id', async (req, res) => {
  const { name, role, text, stars } = req.body;
  try {
    await req.db.request()
      .input('id',    sql.Int,      req.params.id)
      .input('name',  sql.NVarChar, name)
      .input('role',  sql.NVarChar, role||null)
      .input('text',  sql.NVarChar, text||null)
      .input('stars', sql.Int,      parseInt(stars)||5)
      .query('UPDATE testimonials SET name=@name, role=@role, text=@text, stars=@stars WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/testimonials/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM testimonials WHERE id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/admin/users/:id/profile ─────────────────────────
router.get('/users/:id/profile', async (req, res) => {
  try {
    const uid = parseInt(req.params.id);
    const [userRes, cvsRes] = await Promise.all([
      req.db.request().input('id', sql.Int, uid)
        .query(`SELECT id, name, email, plan, role, is_active, created_at, plan_expiry, google_id, linkedin_id
                FROM users WHERE id = @id`),
      req.db.request().input('uid', sql.Int, uid)
        .query(`SELECT id, title, template_name, slug, download_count, is_public, created_at, updated_at
                FROM cvs WHERE user_id = @uid ORDER BY updated_at DESC`)
    ]);
    if (!userRes.recordset.length) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    const user = userRes.recordset[0];
    const cvs  = cvsRes.recordset;
    res.json({
      user,
      cvs,
      stats: {
        totalCvs:       cvs.length,
        totalDownloads: cvs.reduce((s, c) => s + (c.DownloadCount || 0), 0),
        publicCvs:      cvs.filter(c => c.IsPublic).length,
        lastActive:     cvs[0]?.UpdatedAt || user.CreatedAt
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/template-items ────────────────────────────
router.get('/template-items', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT id, name, slug, category, is_premium, preview_url, active, sort_order, created_at
      FROM templates
      ORDER BY active DESC, is_premium ASC, sort_order ASC, name ASC
    `);
    res.json({ templates: r.recordset, total: r.recordset.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/template-items ───────────────────────────
router.post('/template-items', async (req, res) => {
  const { name, slug, category, isPremium } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name e slug obrigatórios' });
  try {
    await req.db.request()
      .input('name', sql.NVarChar, name)
      .input('slug', sql.NVarChar, slug)
      .input('cat',  sql.NVarChar, category || 'Geral')
      .input('prem', sql.Bit, isPremium ? true : false)
      .query(`INSERT INTO templates (name, slug, category, is_premium, active, sort_order, created_at)
              VALUES (@name, @slug, @cat, @prem, TRUE, 0, NOW())`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/admin/template-items/:id/toggle ───────────────
router.patch('/template-items/:id/toggle', async (req, res) => {
  try {
    await req.db.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE templates SET active = NOT active WHERE id=@id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/template-items/activate-all ──────────────
router.post('/template-items/activate-all', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('UPDATE templates SET active=TRUE');
    res.json({ success: true, updated: r.rowsAffected[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/template-items/import-bulk ───────────────
router.post('/template-items/import-bulk', async (req, res) => {
  const { templates } = req.body;
  if (!Array.isArray(templates) || !templates.length)
    return res.status(400).json({ error: 'Array de templates em falta.' });

  let imported = 0, skipped = 0;
  for (const t of templates) {
    const name = (t.name || t.Name || '').trim();
    const cat  = (t.category || t.Category || 'Geral').trim();
    const prem = (t.isPremium !== undefined ? t.isPremium : (t.IsPremium || false));
    const slug = (t.slug || t.Slug || name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-') + '-' + Date.now()).trim();
    const prev = (t.previewUrl || t.PreviewUrl || null);
    if (!name) { skipped++; continue; }
    try {
      await req.db.request()
        .input('name', sql.NVarChar, name)
        .input('slug', sql.NVarChar, slug)
        .input('cat',  sql.NVarChar, cat)
        .input('prem', sql.Bit, prem ? true : false)
        .input('prev', sql.NVarChar, prev)
        .query(`INSERT INTO templates (name, slug, category, is_premium, preview_url, active, sort_order, created_at)
                VALUES (@name, @slug, @cat, @prem, @prev, TRUE, 0, NOW()) ON CONFLICT (slug) DO NOTHING`);
      imported++;
    } catch (e) {
      skipped++;
    }
  }
  res.json({ success: true, imported, skipped });
});

// ── POST /api/admin/template-items/import-sql ────────────────
router.post('/template-items/import-sql', async (req, res) => {
  try {
    const sqlFile = path.join(__dirname, '..', '..', 'more-templates.sql');
    if (!fs.existsSync(sqlFile)) {
      return res.status(404).json({ error: 'Ficheiro more-templates.sql não encontrado.' });
    }
    const raw = fs.readFileSync(sqlFile, 'utf8');
    // Split on semicolons for PostgreSQL (no GO batch separator)
    const batches = raw
      .split(/;\s*\n/)
      .map(b => b.trim())
      .filter(b => b && !/^--/.test(b));

    let imported = 0;
    let skipped  = 0;
    for (const batch of batches) {
      if (!batch.toLowerCase().includes('insert into')) { skipped++; continue; }
      try {
        await req.db.request().query(batch);
        imported++;
      } catch (e) {
        // ignore duplicate slugs (PostgreSQL unique violation code)
        if (e.code === '23505' || (e.message||'').includes('unique') || (e.message||'').includes('duplicate')) {
          skipped++;
        } else {
          skipped++;
        }
      }
    }
    res.json({ success: true, imported, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/analytics ─────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    // Auto-criar tabelas de tracking se ainda não existirem
    await req.db.request().query(`CREATE TABLE IF NOT EXISTS page_views (id SERIAL PRIMARY KEY, page VARCHAR(100) NOT NULL, user_id INTEGER, session_id VARCHAR(64), created_at TIMESTAMP DEFAULT NOW())`).catch(()=>{});
    await req.db.request().query(`CREATE TABLE IF NOT EXISTS support_tickets (id SERIAL PRIMARY KEY, user_id INTEGER, name VARCHAR(100) NOT NULL, email VARCHAR(255), message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'open', reply TEXT, replied_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`).catch(()=>{});

    const safe = async (q) => {
      try { return (await req.db.request().query(q)).recordset; }
      catch(e) { console.warn('analytics safe query failed:', e.message); return []; }
    };
    const safeOne = async (q) => {
      try { return (await req.db.request().query(q)).recordset[0] || {}; }
      catch(e) { console.warn('analytics safeOne query failed:', e.message); return {}; }
    };

    const [byPage, cvStats, openTickets] = await Promise.all([
      safe(`SELECT page, COUNT(*) AS total, COUNT(DISTINCT session_id) AS unique_sessions
            FROM page_views GROUP BY page ORDER BY total DESC`),
      safeOne(`SELECT
        (SELECT COUNT(*) FROM cvs) AS total_cvs,
        (SELECT COUNT(*) FROM cvs WHERE content_json IS NOT NULL AND content_json != '{}' AND content_json != '') AS cvs_with_content,
        (SELECT COUNT(*) FROM page_views) AS views_total,
        (SELECT COUNT(DISTINCT session_id) FROM page_views) AS unique_visitors`),
      safeOne(`SELECT COUNT(*) AS open_tickets FROM support_tickets WHERE status='open'`),
    ]);

    let cvs_downloaded = 0;
    try {
      const r = await req.db.request().query(`SELECT COUNT(*) AS n FROM cvs WHERE download_count > 0`);
      cvs_downloaded = r.recordset[0]?.N || r.recordset[0]?.n || 0;
    } catch(_) {}

    const total_cvs        = Number(cvStats.TotalCvs    || cvStats.total_cvs    || 0);
    const cvs_with_content = Number(cvStats.CvsWithContent || cvStats.cvs_with_content || 0);
    const views_total      = Number(cvStats.ViewsTotal   || cvStats.views_total   || 0);
    const unique_visitors  = Number(cvStats.UniqueVisitors|| cvStats.unique_visitors|| 0);
    const open_tickets     = Number(openTickets.OpenTickets|| openTickets.open_tickets|| 0);

    res.json({
      ok: true,
      stats: {
        total_cvs,
        cvs_with_content,
        cvs_downloaded,
        abandoned: total_cvs - cvs_with_content,
        views_total,
        unique_visitors,
        open_tickets,
      },
      byPage,
    });
  } catch(e) {
    console.error('analytics route error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/support ───────────────────────────────────
router.get('/support', async (req, res) => {
  try {
    const r = await req.db.request().query(
      `SELECT id, user_id, name, email, message, status, reply, replied_at, created_at
       FROM support_tickets ORDER BY created_at DESC`
    );
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/admin/support/:id/reply ────────────────────────
router.post('/support/:id/reply', async (req, res) => {
  const { reply } = req.body;
  if (!reply?.trim()) return res.status(400).json({ error: 'Resposta obrigatória.' });
  try {
    await req.db.request()
      .input('id',    sql.Int,      req.params.id)
      .input('reply', sql.NVarChar, reply.trim())
      .query(`UPDATE support_tickets SET reply=@reply, status='replied', replied_at=NOW() WHERE id=@id`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
