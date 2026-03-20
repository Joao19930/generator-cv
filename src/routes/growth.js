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
      .query('SELECT code FROM referral_codes WHERE user_id=@id')).recordset[0];

    if (!row) {
      const code = crypto.createHash('md5').update(`${req.user.id}-${Date.now()}`).digest('hex').slice(0,8).toUpperCase();
      await req.db.request().input('id', sql.Int, req.user.id).input('code', sql.NVarChar, code)
        .query('INSERT INTO referral_codes (user_id, code, created_at) VALUES (@id, @code, NOW())');
      row = { Code: code };
    }

    const stats = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT COUNT(*) AS total, COUNT(CASE WHEN rewarded=TRUE THEN 1 END) AS rewarded FROM referrals WHERE referrer_id=@id')).recordset[0];

    res.json({
      code: row.Code || row.code,
      link: `${process.env.APP_URL}/r/${row.Code || row.code}`,
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
      .query('SELECT user_id FROM referral_codes WHERE code=@code')).recordset[0];
    if (!ref) return res.json({ applied: false });

    const referrerId = ref.UserId;
    await req.db.request().input('rId', sql.Int, referrerId).input('nId', sql.Int, newUserId)
      .query('INSERT INTO referrals (referrer_id, referred_id, created_at) VALUES (@rId, @nId, NOW())');

    // Verificar se atingiu 3 referrals → upgrade premium
    const count = (await req.db.request().input('id', sql.Int, referrerId)
      .query('SELECT COUNT(*) AS n FROM referrals WHERE referrer_id=@id')).recordset[0].n;

    if (count > 0 && count % 3 === 0) {
      await req.db.request().input('id', sql.Int, referrerId)
        .query(`UPDATE users SET plan='premium', plan_expiry=COALESCE(plan_expiry, NOW()) + INTERVAL '1 month' WHERE id=@id`);
      await req.db.request().input('id', sql.Int, referrerId)
        .query(`UPDATE referrals SET rewarded=TRUE WHERE referrer_id=@id AND rewarded=FALSE`);
      socketConnector.toUser(referrerId, 'plan_upgraded', { message: 'Ganhou 1 mês Premium pelas suas indicações!' });
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
    const tmpls = await req.db.request().query(`SELECT slug FROM templates WHERE active=TRUE`);
    for (const t of tmpls.recordset)
      xml += `  <url><loc>${process.env.APP_URL}/templates/${t.Slug || t.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
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
      .query(`SELECT c.title, u.name FROM cvs c INNER JOIN users u ON u.id=c.user_id WHERE c.id=@id AND c.is_public=TRUE`)).recordset[0];
    if (!cv) return res.status(404).json({ error: 'CV não encontrado ou privado' });
    res.json({
      og_title:       `${cv.Name || cv.name} — CV Profissional`,
      og_description: `Veja o CV profissional de ${cv.Name || cv.name} criado com CV Premium`,
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
        .query(`INSERT INTO leads (email, ats_score, source, created_at) VALUES (@email, @score, 'ats_public', NOW()) ON CONFLICT (email) DO NOTHING`).catch(() => {});
      zapierConnector.onLead(email, score.score);
    }
    res.json(score);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
