// src/routes/growth.js
// ─────────────────────────────────────────────────────────────
// Growth Engine: referral, sitemap, OG share, ATS tool público
// ─────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { sql }  = require('../config/database');
const { socketConnector, redisConnector, openaiConnector, zapierConnector } = require('../connectors');
const { auth }       = require('../middleware/auth');
const { toolLimiter } = require('../middleware/rateLimiter');

// ── GET /api/growth/referral — Obter/criar código de referral ─
router.get('/referral', auth, async (req, res) => {
  try {
    let row = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT Code FROM ReferralCodes WHERE UserId=@id')).recordset[0];

    if (!row) {
      const code = crypto.createHash('md5').update(`${req.user.id}-${Date.now()}`).digest('hex').slice(0,8).toUpperCase();
      await req.db.request().input('id', sql.Int, req.user.id).input('code', sql.NVarChar, code)
        .query('INSERT INTO ReferralCodes (UserId, Code, CreatedAt) VALUES (@id, @code, GETDATE())');
      row = { Code: code };
    }

    const stats = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT COUNT(*) AS total, COUNT(CASE WHEN Rewarded=1 THEN 1 END) AS rewarded FROM Referrals WHERE ReferrerId=@id')).recordset[0];

    res.json({
      code: row.Code,
      link: `${process.env.APP_URL}/r/${row.Code}`,
      stats,
      next_reward: Math.max(0, 3 - (stats.total % 3))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/growth/referral/apply — Aplicar referral no registo ─
router.post('/referral/apply', async (req, res) => {
  const { code, newUserId } = req.body;
  if (!code || !newUserId) return res.json({ applied: false });
  try {
    const ref = (await req.db.request().input('code', sql.NVarChar, code)
      .query('SELECT UserId FROM ReferralCodes WHERE Code=@code')).recordset[0];
    if (!ref) return res.json({ applied: false });

    const referrerId = ref.UserId;
    await req.db.request().input('rId', sql.Int, referrerId).input('nId', sql.Int, newUserId)
      .query('INSERT INTO Referrals (ReferrerId, ReferredId, CreatedAt) VALUES (@rId, @nId, GETDATE())');

    // Verificar se atingiu 3 referrals → upgrade premium
    const count = (await req.db.request().input('id', sql.Int, referrerId)
      .query('SELECT COUNT(*) AS n FROM Referrals WHERE ReferrerId=@id')).recordset[0].n;

    if (count > 0 && count % 3 === 0) {
      await req.db.request().input('id', sql.Int, referrerId)
        .query(`UPDATE Users SET [Plan]='premium', PlanExpiry=DATEADD(month,1,ISNULL(PlanExpiry,GETDATE())) WHERE Id=@id;
                UPDATE Referrals SET Rewarded=1 WHERE ReferrerId=@id AND Rewarded=0`);
      socketConnector.toUser(referrerId, 'plan_upgraded', { message: '🎉 Ganhou 1 mês Premium pelas suas indicações!' });
    }
    res.json({ applied: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/growth/sitemap.xml ──────────────────────────────
router.get('/sitemap.xml', async (req, res) => {
  const cached = await redisConnector.get('sitemap').catch(() => null);
  if (cached) { res.set('Content-Type','text/xml'); return res.send(cached); }

  const statics = ['','/templates','/pricing','/blog','/ferramentas/ats','/login','/registar','/sobre'];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const u of statics)
    xml += `  <url><loc>${process.env.APP_URL}${u}</loc><changefreq>weekly</changefreq><priority>${u===''?'1.0':'0.8'}</priority></url>\n`;

  try {
    const tmpls = await req.db.request().query(`SELECT Slug FROM Templates WHERE Active=1`);
    for (const t of tmpls.recordset)
      xml += `  <url><loc>${process.env.APP_URL}/templates/${t.Slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  } catch (_) {}
  xml += `</urlset>`;

  await redisConnector.set('sitemap', xml, 86400).catch(() => {});
  res.set('Content-Type','text/xml');
  res.send(xml);
});

// ── GET /api/growth/share/:cvId — Open Graph para partilha ──
router.get('/share/:cvId', async (req, res) => {
  try {
    const cv = (await req.db.request().input('id', sql.Int, req.params.cvId)
      .query(`SELECT c.Title, u.Name FROM CVs c INNER JOIN Users u ON u.Id=c.UserId WHERE c.Id=@id AND c.IsPublic=1`)).recordset[0];
    if (!cv) return res.status(404).json({ error: 'CV não encontrado ou privado' });
    res.json({
      og_title:       `${cv.Name} — CV Profissional`,
      og_description: `Veja o CV profissional de ${cv.Name} criado com CV Generator`,
      og_image:       `${process.env.APP_URL}/api/og/${req.params.cvId}`,
      og_url:         `${process.env.APP_URL}/cv/${req.params.cvId}`
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/growth/ats — Ferramenta ATS pública (lead magnet) ─
router.post('/ats', toolLimiter, async (req, res) => {
  const { cvText, jobDescription, email } = req.body;
  if (!cvText || !jobDescription)
    return res.status(400).json({ error: 'cvText e jobDescription são obrigatórios' });
  try {
    const score = await openaiConnector.atsScore(cvText, jobDescription);
    if (email) {
      req.db.request().input('email', sql.NVarChar, email).input('score', sql.Int, score.score)
        .query(`IF NOT EXISTS (SELECT 1 FROM Leads WHERE Email=@email)
                  INSERT INTO Leads (Email,ATSScore,Source,CreatedAt) VALUES (@email,@score,'ats_public',GETDATE())`).catch(() => {});
      zapierConnector.onLead(email, score.score);
    }
    res.json(score);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
