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
        (SELECT COUNT(*) FROM Users)                                                              AS total_users,
        (SELECT COUNT(*) FROM Users WHERE CreatedAt >= DATEADD(day,-30,GETDATE()))               AS new_users_30d,
        (SELECT COUNT(*) FROM Users WHERE [Plan] = 'premium')                                      AS premium_users,
        (SELECT COUNT(*) FROM Users WHERE CreatedAt >= DATEADD(day,-1,GETDATE()))                AS new_today,
        (SELECT COUNT(*) FROM CVs)                                                               AS total_cvs,
        (SELECT COUNT(*) FROM CVs WHERE CreatedAt >= DATEADD(day,-1,GETDATE()))                  AS cvs_today,
        (SELECT COUNT(*) FROM CVs WHERE CreatedAt >= DATEADD(day,-7,GETDATE()))                  AS cvs_7d,
        (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE Status='paid')                         AS total_revenue,
        (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE Status='paid' AND CreatedAt >= DATEADD(day,-30,GETDATE())) AS revenue_30d,
        (SELECT COUNT(*) FROM Payments WHERE Status='paid' AND CreatedAt >= DATEADD(day,-30,GETDATE())) AS paid_30d,
        (SELECT CAST(COUNT(*) AS FLOAT) / NULLIF((SELECT COUNT(*) FROM Users WHERE CreatedAt >= DATEADD(day,-30,GETDATE())),0)*100
         FROM Payments WHERE Status='paid' AND CreatedAt >= DATEADD(day,-30,GETDATE()))          AS conversion_rate
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
        SELECT u.Id, u.Name, u.Email, u.[Plan], u.Role, u.IsActive, u.CreatedAt, u.LastLogin,
               COUNT(DISTINCT c.Id) AS cv_count,
               ISNULL(SUM(p.Amount),0) AS total_spent
        FROM Users u
        LEFT JOIN CVs c      ON c.UserId = u.Id
        LEFT JOIN Payments p ON p.UserId = u.Id AND p.Status = 'paid'
        WHERE (u.Name LIKE @s OR u.Email LIKE @s) AND (@plan='' OR u.[Plan]=@plan)
        GROUP BY u.Id,u.Name,u.Email,u.[Plan],u.Role,u.IsActive,u.CreatedAt,u.LastLogin
        ORDER BY u.CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);
    const total = (await req.db.request().input('s', sql.NVarChar, `%${search}%`).input('plan', sql.NVarChar, plan)
      .query(`SELECT COUNT(*) AS n FROM Users WHERE (Name LIKE @s OR Email LIKE @s) AND (@plan='' OR [Plan]=@plan)`)).recordset[0].n;
    res.json({ users: r.recordset, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/revenue/chart ─────────────────────────────
router.get('/revenue/chart', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT CAST(CreatedAt AS DATE) AS date, SUM(Amount) AS revenue, COUNT(*) AS tx
      FROM Payments WHERE Status='paid' AND CreatedAt >= DATEADD(day,-30,GETDATE())
      GROUP BY CAST(CreatedAt AS DATE) ORDER BY date ASC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/growth ────────────────────────────────────
router.get('/growth', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT FORMAT(CreatedAt,'yyyy-MM') AS month,
             COUNT(*) AS new_users,
             COUNT(CASE WHEN [Plan]='premium' THEN 1 END) AS new_premium
      FROM Users WHERE CreatedAt >= DATEADD(month,-12,GETDATE())
      GROUP BY FORMAT(CreatedAt,'yyyy-MM') ORDER BY month ASC
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/funnel ────────────────────────────────────
router.get('/funnel', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Users)                                       AS registered,
        (SELECT COUNT(DISTINCT UserId) FROM CVs)                          AS created_cv,
        (SELECT COUNT(DISTINCT UserId) FROM CVs WHERE Downloaded=1)       AS downloaded_cv,
        (SELECT COUNT(DISTINCT UserId) FROM Payments WHERE Status='paid') AS paid
    `);
    const d = r.recordset[0];
    const base = d.registered || 1;
    res.json([
      { step: '1. Registados',        count: d.registered,   pct: 100 },
      { step: '2. Criaram CV',        count: d.created_cv,   pct: +((d.created_cv/base)*100).toFixed(1) },
      { step: '3. Fizeram Download',  count: d.downloaded_cv,pct: +((d.downloaded_cv/base)*100).toFixed(1) },
      { step: '4. Compraram Premium', count: d.paid,         pct: +((d.paid/base)*100).toFixed(1) }
    ]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/templates ─────────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT TemplateId, TemplateName, COUNT(*) AS uses,
             COUNT(CASE WHEN CreatedAt >= DATEADD(day,-7,GETDATE()) THEN 1 END) AS uses_7d
      FROM CVs GROUP BY TemplateId, TemplateName ORDER BY uses DESC
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
        SELECT p.Id,p.Amount,p.Currency,p.Status,p.Method,p.CreatedAt,p.StripeSessionId,
               u.Name AS user_name, u.Email AS user_email
        FROM Payments p INNER JOIN Users u ON u.Id=p.UserId
        ORDER BY p.CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:id/ban ────────────────────────────
router.post('/users/:id/ban', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).input('by', sql.Int, req.user.id)
      .query('UPDATE Users SET IsActive=0, BannedAt=GETDATE(), BannedBy=@by WHERE Id=@id');
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
      .query('UPDATE Users SET [Plan]=@plan, PlanExpiry=@exp WHERE Id=@id');
    await redisConnector.del('admin:overview');
    res.json({ success: true, plan, expiry });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COACHES CRUD ─────────────────────────────────────────────
router.get('/coaches', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM Coaches ORDER BY CreatedAt DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/coaches', async (req, res) => {
  const { name, location, bio, skills, email, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
  try {
    const r = await req.db.request()
      .input('name',     sql.NVarChar, name)
      .input('location', sql.NVarChar, location||null)
      .input('bio',      sql.NVarChar, bio||null)
      .input('skills',   sql.NVarChar, skills||null)
      .input('email',    sql.NVarChar, email||null)
      .input('color',    sql.NVarChar, color||'#6366f1')
      .query(`INSERT INTO Coaches (Name,Location,Bio,Skills,Email,Color,Active,CreatedAt)
              OUTPUT INSERTED.Id VALUES (@name,@location,@bio,@skills,@email,@color,1,GETDATE())`);
    res.json({ success: true, id: r.recordset[0].Id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/coaches/:id', async (req, res) => {
  const { name, location, bio, skills, email, color } = req.body;
  try {
    await req.db.request()
      .input('id',       sql.Int,      req.params.id)
      .input('name',     sql.NVarChar, name)
      .input('location', sql.NVarChar, location||null)
      .input('bio',      sql.NVarChar, bio||null)
      .input('skills',   sql.NVarChar, skills||null)
      .input('email',    sql.NVarChar, email||null)
      .input('color',    sql.NVarChar, color||'#6366f1')
      .query('UPDATE Coaches SET Name=@name,Location=@location,Bio=@bio,Skills=@skills,Email=@email,Color=@color WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/coaches/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM Coaches WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── COURSES CRUD ──────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM Courses ORDER BY CreatedAt DESC');
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
      .query(`INSERT INTO Courses (Title,Source,Category,Rating,Url,Active,CreatedAt)
              OUTPUT INSERTED.Id VALUES (@title,@source,@category,@rating,@url,1,GETDATE())`);
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
      .query('UPDATE Courses SET Title=@title,Source=@source,Category=@category,Rating=@rating,Url=@url WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/courses/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM Courses WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── JOBS CRUD ─────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM Jobs ORDER BY CreatedAt DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/jobs', async (req, res) => {
  const { title, company, city, country, category, date, jobDate, url } = req.body;
  if (!title) return res.status(400).json({ error: 'Título obrigatório.' });
  const d = jobDate || date || null;
  try {
    const r = await req.db.request()
      .input('title',   sql.NVarChar, title)
      .input('company', sql.NVarChar, company||null)
      .input('city',    sql.NVarChar, city||null)
      .input('country', sql.NVarChar, country||null)
      .input('cat',     sql.NVarChar, category||null)
      .input('date',    sql.Date,     d ? new Date(d) : null)
      .input('url',     sql.NVarChar, url||null)
      .query(`INSERT INTO Jobs (Title,Company,City,Country,Category,JobDate,Url,Active,CreatedAt)
              OUTPUT INSERTED.Id VALUES (@title,@company,@city,@country,@cat,@date,@url,1,GETDATE())`);
    res.json({ success: true, id: r.recordset[0].Id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/jobs/:id', async (req, res) => {
  const { title, company, city, country, category, date, jobDate, url } = req.body;
  const d = jobDate || date || null;
  try {
    await req.db.request()
      .input('id',      sql.Int,      req.params.id)
      .input('title',   sql.NVarChar, title)
      .input('company', sql.NVarChar, company||null)
      .input('city',    sql.NVarChar, city||null)
      .input('country', sql.NVarChar, country||null)
      .input('cat',     sql.NVarChar, category||null)
      .input('date',    sql.Date,     d ? new Date(d) : null)
      .input('url',     sql.NVarChar, url||null)
      .query('UPDATE Jobs SET Title=@title,Company=@company,City=@city,Country=@country,Category=@cat,JobDate=@date,Url=@url WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/jobs/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM Jobs WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TESTIMONIALS CRUD ─────────────────────────────────────────
router.get('/testimonials', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM Testimonials ORDER BY CreatedAt DESC');
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
      .query(`INSERT INTO Testimonials (Name,Role,[Text],Stars,Active,CreatedAt)
              OUTPUT INSERTED.Id VALUES (@name,@role,@text,@stars,1,GETDATE())`);
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
      .query('UPDATE Testimonials SET Name=@name,Role=@role,[Text]=@text,Stars=@stars WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/testimonials/:id', async (req, res) => {
  try {
    await req.db.request().input('id', sql.Int, req.params.id).query('DELETE FROM Testimonials WHERE Id=@id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/admin/users/:id/profile ─────────────────────────
router.get('/users/:id/profile', async (req, res) => {
  try {
    const uid = parseInt(req.params.id);
    const [userRes, cvsRes] = await Promise.all([
      req.db.request().input('id', sql.Int, uid)
        .query(`SELECT Id, Name, Email, [Plan], [Role], IsActive, CreatedAt, PlanExpiry, GoogleId, LinkedInId
                FROM Users WHERE Id = @id`),
      req.db.request().input('uid', sql.Int, uid)
        .query(`SELECT Id, Title, TemplateName, Slug, DownloadCount, IsPublic, CreatedAt, UpdatedAt
                FROM CVs WHERE UserId = @uid ORDER BY UpdatedAt DESC`)
    ]);
    if (!userRes.recordset.length) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    const user = userRes.recordset[0];
    const cvs  = cvsRes.recordset;
    res.json({
      user,
      cvs,
      stats: {
        totalCvs:      cvs.length,
        totalDownloads: cvs.reduce((s, c) => s + (c.DownloadCount || 0), 0),
        publicCvs:     cvs.filter(c => c.IsPublic).length,
        lastActive:    cvs[0]?.UpdatedAt || user.CreatedAt
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/template-items ────────────────────────────
router.get('/template-items', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT Id, Name, Slug, Category, IsPremium, PreviewUrl, Active, SortOrder, CreatedAt
      FROM Templates
      ORDER BY Active DESC, IsPremium ASC, SortOrder ASC, Name ASC
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
      .input('prem', sql.Bit, isPremium ? 1 : 0)
      .query(`INSERT INTO Templates (Name,Slug,Category,IsPremium,Active,SortOrder,CreatedAt)
              VALUES (@name,@slug,@cat,@prem,1,0,GETDATE())`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/admin/template-items/:id/toggle ───────────────
router.patch('/template-items/:id/toggle', async (req, res) => {
  try {
    await req.db.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE Templates SET Active = CASE WHEN Active=1 THEN 0 ELSE 1 END WHERE Id=@id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/template-items/activate-all ──────────────
router.post('/template-items/activate-all', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('UPDATE Templates SET Active=1; SELECT @@ROWCOUNT AS updated');
    res.json({ success: true, updated: r.recordset[0]?.updated });
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
    const prem = (t.isPremium !== undefined ? t.isPremium : (t.IsPremium || 0));
    const slug = (t.slug || t.Slug || name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-') + '-' + Date.now()).trim();
    const prev = (t.previewUrl || t.PreviewUrl || null);
    if (!name) { skipped++; continue; }
    try {
      await req.db.request()
        .input('name', sql.NVarChar, name)
        .input('slug', sql.NVarChar, slug)
        .input('cat',  sql.NVarChar, cat)
        .input('prem', sql.Bit, prem ? 1 : 0)
        .input('prev', sql.NVarChar, prev)
        .query(`INSERT INTO Templates (Name,Slug,Category,IsPremium,PreviewUrl,Active,SortOrder,CreatedAt)
                VALUES (@name,@slug,@cat,@prem,@prev,1,0,GETDATE())`);
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
    // Split on GO (batch separator) and filter out USE/GO/empty lines
    const batches = raw
      .split(/\r?\nGO\r?\n/i)
      .map(b => b.trim())
      .filter(b => b && !/^USE\s/i.test(b) && !/^--/.test(b));

    let imported = 0;
    let skipped  = 0;
    for (const batch of batches) {
      if (!batch.toLowerCase().includes('insert into')) { skipped++; continue; }
      try {
        await req.db.request().query(batch);
        imported++;
      } catch (e) {
        // ignore duplicate slugs
        if (e.number === 2627 || (e.message||'').includes('UNIQUE') || (e.message||'').includes('duplicate')) {
          skipped++;
        } else {
          skipped++;
        }
      }
    }
    res.json({ success: true, imported, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
