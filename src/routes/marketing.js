// src/routes/marketing.js
// ─────────────────────────────────────────────────────────────
// Motor de Marketing Automation — CV Premium
//
// Rotas públicas:
//   POST /api/marketing/track              — rastrear evento
//   GET  /api/marketing/unsubscribe        — cancelar subscrição
//   PUT  /api/marketing/preferences        — actualizar preferências (JWT)
//   GET  /api/marketing/preferences        — ler preferências (JWT)
//
// Rotas admin:
//   GET  /api/marketing/admin/dashboard    — métricas gerais
//   GET  /api/marketing/admin/segments     — listar segmentos + contagem
//   GET  /api/marketing/admin/campaigns    — listar campanhas
//   POST /api/marketing/admin/campaigns    — criar campanha
//   PUT  /api/marketing/admin/campaigns/:id — editar campanha
//   POST /api/marketing/admin/campaigns/:id/send — enviar campanha
//   GET  /api/marketing/admin/campaigns/:id/stats — stats da campanha
//   DELETE /api/marketing/admin/campaigns/:id — apagar campanha (draft)
//   GET  /api/marketing/admin/rules        — listar regras de automação
//   POST /api/marketing/admin/rules        — criar regra
//   PUT  /api/marketing/admin/rules/:id    — editar regra (activar/desactivar)
//   GET  /api/marketing/admin/funnel       — funil de conversão
//   GET  /api/marketing/admin/leads        — leads da ferramenta ATS
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { sql } = require('../config/database');
const {
  emailConnector, smtpConnector,
  redisConnector, zapierConnector,
  openaiConnector
} = require('../connectors');
const { auth, adminOnly } = require('../middleware/auth');

// ── Utilitários ──────────────────────────────────────────────

// Gerar token de unsubscribe único e assinado
const genUnsubToken = (userId) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'mkt-secret')
    .update(String(userId)).digest('hex').slice(0, 32);

// Substituir variáveis num template de e-mail/WhatsApp
const renderTemplate = (tpl, vars) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');

// Wrapper do template base de e-mail (reutiliza o estilo do emailConnector)
const wrapEmail = (content) => `
<!DOCTYPE html><html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px}
  .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px}
  .body{padding:32px 40px}
  .body p{color:#374151;line-height:1.7;margin:0 0 16px;font-size:15px}
  .btn{display:inline-block;margin:8px 0 24px;padding:14px 32px;background:#2563eb;color:#fff!important;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px}
  .highlight{background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0}
  .highlight strong{color:#1d4ed8}
  .footer{background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb}
  .footer p{color:#9ca3af;font-size:12px;margin:0}
</style></head>
<body><div class="wrap">
  <div class="header"><h1>CV Premium</h1><p>cvpremium.net</p></div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} CV Premium — Luanda, Angola</p>
    <p style="margin-top:6px"><a href="{{UNSUB_URL}}" style="color:#9ca3af">Cancelar subscrição de e-mails</a></p>
  </div>
</div></body></html>`;

// Enviar e-mail com fallback SMTP
const sendEmail = async (to, subject, html) => {
  try {
    const sg = require('@sendgrid/mail');
    sg.setApiKey(process.env.SENDGRID_API_KEY);
    await sg.send({ to, from: { email: process.env.EMAIL_FROM || 'noreply@cvpremium.net', name: 'CV Premium' }, subject, html });
  } catch (_) {
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT || 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await t.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  }
};

// ════════════════════════════════════════════════════════════
// ROTAS PÚBLICAS
// ════════════════════════════════════════════════════════════

// ── POST /api/marketing/track — Rastrear evento comportamental ─
// Chamado a partir do frontend (pixel de eventos)
router.post('/track', async (req, res) => {
  const { event, properties, page, session_id, source, medium, campaign } = req.body;
  if (!event || !session_id) return res.json({ ok: false });

  // Identificar utilizador (pode ser anónimo se não houver JWT)
  let userId = null;
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    }
  } catch (_) {}

  try {
    await req.db.request()
      .input('userId',   sql.Int,      userId)
      .input('session',  sql.NVarChar, session_id)
      .input('event',    sql.NVarChar, event.slice(0, 80))
      .input('props',    sql.NVarChar, properties ? JSON.stringify(properties) : null)
      .input('page',     sql.NVarChar, (page || '').slice(0, 200))
      .input('source',   sql.NVarChar, (source || '').slice(0, 80))
      .input('medium',   sql.NVarChar, (medium || '').slice(0, 80))
      .input('campaign', sql.NVarChar, (campaign || '').slice(0, 80))
      .input('ip',       sql.NVarChar, (req.ip || '').slice(0, 45))
      .query(`INSERT INTO user_events
        (user_id, session_id, event, properties, page, source, medium, campaign, ip, created_at)
        VALUES (@userId, @session, @event, @props, @page, @source, @medium, @campaign, @ip, NOW())`);
  } catch (_) {}

  res.json({ ok: true });
});

// ── GET /api/marketing/unsubscribe?token=xxx&email=xxx ───────
router.get('/unsubscribe', async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) return res.status(400).send('<p>Link inválido.</p>');

  try {
    const user = (await req.db.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, unsubscribe_token FROM users WHERE email = @email')).recordset[0];

    if (!user || user.unsubscribe_token !== token)
      return res.status(400).send('<p>Link de cancelamento inválido ou expirado.</p>');

    await req.db.request()
      .input('id', sql.Int, user.id)
      .query(`UPDATE users SET marketing_email = FALSE, marketing_whatsapp = FALSE WHERE id = @id`);

    // Marcar todos os e-mails pendentes como cancelados
    await req.db.request()
      .input('email', sql.NVarChar, email)
      .query(`UPDATE email_queue SET sent = TRUE WHERE email = @email AND sent = FALSE`).catch(() => {});

    res.send(`<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Cancelado</title>
<style>body{font-family:Arial,sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#fff;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08)}
h1{color:#1f2937;font-size:22px}p{color:#6b7280;font-size:15px}a{color:#2563eb}</style></head>
<body><div class="box"><h1>Cancelado com sucesso</h1>
<p>Deixarás de receber e-mails de marketing do CV Premium.</p>
<p>Podes voltar a activar as notificações nas tuas <a href="${process.env.APP_URL}/definicoes">Definições</a>.</p>
</div></body></html>`);
  } catch (err) {
    res.status(500).send('<p>Erro ao processar o pedido. Tenta novamente.</p>');
  }
});

// ── GET /api/marketing/preferences — Ler preferências (JWT) ──
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = (await req.db.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT marketing_email, marketing_whatsapp, marketing_sms, phone FROM users WHERE id = @id')).recordset[0];
    res.json(user || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/marketing/preferences — Actualizar preferências ─
router.put('/preferences', auth, async (req, res) => {
  const { marketing_email, marketing_whatsapp, marketing_sms, phone } = req.body;
  try {
    await req.db.request()
      .input('id',    sql.Int,      req.user.id)
      .input('email', sql.Bit,      marketing_email  !== undefined ? (marketing_email  ? 1 : 0) : null)
      .input('wa',    sql.Bit,      marketing_whatsapp !== undefined ? (marketing_whatsapp ? 1 : 0) : null)
      .input('sms',   sql.Bit,      marketing_sms    !== undefined ? (marketing_sms    ? 1 : 0) : null)
      .input('phone', sql.NVarChar, phone || null)
      .query(`UPDATE users SET
        marketing_email     = COALESCE(NULLIF(@email, -1), marketing_email),
        marketing_whatsapp  = COALESCE(NULLIF(@wa, -1),    marketing_whatsapp),
        marketing_sms       = COALESCE(NULLIF(@sms, -1),   marketing_sms),
        phone               = COALESCE(@phone, phone)
        WHERE id = @id`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// ROTAS ADMIN (auth + adminOnly aplicados em server.js)
// ════════════════════════════════════════════════════════════

// ── GET /api/marketing/admin/dashboard ───────────────────────
router.get('/admin/dashboard', async (req, res) => {
  try {
    const cached = await redisConnector.get('mkt:dashboard');
    if (cached) return res.json(cached);

    const r = await req.db.request().query(`
      SELECT
        (SELECT COUNT(*) FROM user_events WHERE created_at >= NOW() - INTERVAL '1 day')  AS events_today,
        (SELECT COUNT(*) FROM user_events WHERE created_at >= NOW() - INTERVAL '7 days') AS events_7d,
        (SELECT COUNT(*) FROM user_events WHERE event = 'pricing_visited' AND created_at >= NOW() - INTERVAL '7 days') AS pricing_visits_7d,
        (SELECT COUNT(*) FROM user_events WHERE event = 'cv_created' AND created_at >= NOW() - INTERVAL '7 days')      AS cv_created_7d,
        (SELECT COUNT(*) FROM user_events WHERE event = 'ats_used' AND created_at >= NOW() - INTERVAL '7 days')        AS ats_used_7d,
        (SELECT COUNT(*) FROM campaigns WHERE status = 'sent') AS campaigns_sent,
        (SELECT COALESCE(SUM(total_sent),0) FROM campaigns)    AS total_emails_sent,
        (SELECT COALESCE(SUM(total_opened),0) FROM campaigns)  AS total_opened,
        (SELECT COUNT(*) FROM leads)                           AS total_leads,
        (SELECT COUNT(*) FROM leads WHERE converted = TRUE)    AS leads_converted,
        (SELECT COUNT(*) FROM users WHERE marketing_email = FALSE) AS unsubscribed
    `);

    const data = r.recordset[0];
    // Calcular taxa de abertura
    data.open_rate = data.total_emails_sent > 0
      ? ((data.total_opened / data.total_emails_sent) * 100).toFixed(1)
      : 0;
    data.lead_conversion = data.total_leads > 0
      ? ((data.leads_converted / data.total_leads) * 100).toFixed(1)
      : 0;

    // Top eventos 7d
    const topEvents = await req.db.request().query(`
      SELECT event, COUNT(*) AS cnt FROM user_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY event ORDER BY cnt DESC LIMIT 10
    `);
    data.top_events = topEvents.recordset;

    // Eventos por dia (últimos 14 dias)
    const dailyEvents = await req.db.request().query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS cnt
      FROM user_events WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at) ORDER BY day
    `);
    data.daily_events = dailyEvents.recordset;

    await redisConnector.set('mkt:dashboard', data, 300);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/marketing/admin/funnel — Funil de conversão ─────
router.get('/admin/funnel', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT
        (SELECT COUNT(DISTINCT session_id) FROM user_events WHERE event = 'page_view')           AS step_visits,
        (SELECT COUNT(*) FROM users)                                                              AS step_registers,
        (SELECT COUNT(DISTINCT user_id) FROM user_events WHERE event = 'cv_created' AND user_id IS NOT NULL) AS step_cv_created,
        (SELECT COUNT(DISTINCT user_id) FROM user_events WHERE event = 'pricing_visited' AND user_id IS NOT NULL) AS step_pricing,
        (SELECT COUNT(*) FROM payments WHERE status = 'paid')                                     AS step_paid
    `);
    res.json(r.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/marketing/admin/segments ────────────────────────
router.get('/admin/segments', async (req, res) => {
  try {
    const segs = (await req.db.request()
      .query('SELECT * FROM marketing_segments ORDER BY id')).recordset;

    // Contar utilizadores por segmento (executar o sql_filter de cada um)
    const withCounts = await Promise.all(segs.map(async (seg) => {
      try {
        const q = `SELECT COUNT(*) AS n FROM users WHERE ${seg.SqlFilter || seg.sql_filter}`;
        const r = await req.db.request().query(q);
        return { ...seg, user_count: r.recordset[0]?.n || 0 };
      } catch (_) {
        return { ...seg, user_count: '?' };
      }
    }));

    res.json(withCounts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/marketing/admin/campaigns ───────────────────────
router.get('/admin/campaigns', async (req, res) => {
  try {
    const r = await req.db.request().query(`
      SELECT c.*, s.name AS segment_name
      FROM campaigns c
      LEFT JOIN marketing_segments s ON s.id = c.segment_id
      ORDER BY c.created_at DESC LIMIT 50
    `);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/marketing/admin/campaigns ──────────────────────
router.post('/admin/campaigns', async (req, res) => {
  const { name, subject, channel = 'email', body_html, body_text, segment_id, scheduled_at } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

  try {
    const r = await req.db.request()
      .input('name',    sql.NVarChar, name)
      .input('subject', sql.NVarChar, subject || null)
      .input('channel', sql.NVarChar, channel)
      .input('html',    sql.NVarChar, body_html || null)
      .input('text',    sql.NVarChar, body_text || null)
      .input('segId',   sql.Int,      segment_id || null)
      .input('schAt',   sql.DateTime, scheduled_at ? new Date(scheduled_at) : null)
      .input('userId',  sql.Int,      req.user.id)
      .query(`INSERT INTO campaigns (name, subject, channel, body_html, body_text, segment_id, scheduled_at, created_by, created_at, updated_at)
              VALUES (@name, @subject, @channel, @html, @text, @segId, @schAt, @userId, NOW(), NOW())
              RETURNING id`);
    res.json({ ok: true, id: r.recordset[0]?.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/marketing/admin/campaigns/:id ───────────────────
router.put('/admin/campaigns/:id', async (req, res) => {
  const { name, subject, body_html, body_text, segment_id, scheduled_at, status } = req.body;
  try {
    await req.db.request()
      .input('id',      sql.Int,      Number(req.params.id))
      .input('name',    sql.NVarChar, name    || null)
      .input('subject', sql.NVarChar, subject || null)
      .input('html',    sql.NVarChar, body_html || null)
      .input('text',    sql.NVarChar, body_text || null)
      .input('segId',   sql.Int,      segment_id || null)
      .input('schAt',   sql.DateTime, scheduled_at ? new Date(scheduled_at) : null)
      .input('status',  sql.NVarChar, status  || null)
      .query(`UPDATE campaigns SET
        name         = COALESCE(@name, name),
        subject      = COALESCE(@subject, subject),
        body_html    = COALESCE(@html, body_html),
        body_text    = COALESCE(@text, body_text),
        segment_id   = COALESCE(@segId, segment_id),
        scheduled_at = COALESCE(@schAt, scheduled_at),
        status       = COALESCE(@status, status),
        updated_at   = NOW()
        WHERE id = @id AND status != 'sent'`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/marketing/admin/campaigns/:id ────────────────
router.delete('/admin/campaigns/:id', async (req, res) => {
  try {
    await req.db.request()
      .input('id', sql.Int, Number(req.params.id))
      .query(`DELETE FROM campaigns WHERE id = @id AND status = 'draft'`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/marketing/admin/campaigns/:id/send — Enviar ────
router.post('/admin/campaigns/:id/send', async (req, res) => {
  const campId = Number(req.params.id);
  try {
    const camp = (await req.db.request()
      .input('id', sql.Int, campId)
      .query('SELECT * FROM campaigns WHERE id = @id')).recordset[0];

    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if ((camp.Status || camp.status) === 'sent')
      return res.status(400).json({ error: 'Campanha já enviada' });

    // Obter segmento
    let usersQuery = 'SELECT id, name, email, phone, unsubscribe_token, marketing_email, marketing_whatsapp FROM users WHERE 1=1';
    if (camp.SegmentId || camp.segment_id) {
      const seg = (await req.db.request()
        .input('sid', sql.Int, camp.SegmentId || camp.segment_id)
        .query('SELECT sql_filter FROM marketing_segments WHERE id = @sid')).recordset[0];
      if (seg) usersQuery += ` AND (${seg.SqlFilter || seg.sql_filter})`;
    }
    usersQuery += ' AND marketing_email = TRUE LIMIT 5000';

    const users = (await req.db.request().query(usersQuery)).recordset;

    if (!users.length)
      return res.json({ ok: true, sent: 0, message: 'Nenhum utilizador no segmento' });

    // Marcar como a enviar
    await req.db.request()
      .input('id', sql.Int, campId)
      .query(`UPDATE campaigns SET status = 'sending', updated_at = NOW() WHERE id = @id`);

    // Enviar em background — responder imediatamente
    res.json({ ok: true, queued: users.length, message: 'A enviar em segundo plano...' });

    // Processar envios
    const channel  = camp.Channel || camp.channel || 'email';
    const subject  = camp.Subject || camp.subject || 'Novidades do CV Premium';
    const bodyHtml = camp.BodyHtml || camp.body_html || '';
    const bodyText = camp.BodyText || camp.body_text || '';
    const APP_URL  = process.env.APP_URL || 'https://cvpremium.net';

    let sent = 0;
    for (const u of users) {
      const email    = u.Email || u.email;
      const name     = (u.Name  || u.name  || '').split(' ')[0] || 'Candidato';
      const phone    = u.Phone  || u.phone;
      const unsubTkn = u.UnsubscribeToken || u.unsubscribe_token;
      const unsubUrl = `${APP_URL}/api/marketing/unsubscribe?token=${unsubTkn}&email=${encodeURIComponent(email)}`;

      // Verificar se já foi enviado a este utilizador nesta campanha
      const already = (await req.db.request()
        .input('cid', sql.Int, campId)
        .input('em',  sql.NVarChar, email)
        .query('SELECT id FROM campaign_sends WHERE campaign_id = @cid AND email = @em')).recordset[0];
      if (already) continue;

      const vars = { name, APP_URL, UNSUB_URL: unsubUrl };

      try {
        if (channel === 'email') {
          const html = wrapEmail(renderTemplate(bodyHtml, vars)).replace('{{UNSUB_URL}}', unsubUrl);
          await sendEmail(email, renderTemplate(subject, vars), html);
        } else if (channel === 'whatsapp' && phone) {
          // WhatsApp via Twilio
          const { twilioConnector } = require('../connectors');
          const text = renderTemplate(bodyText || bodyHtml.replace(/<[^>]+>/g, ' '), vars);
          await twilioConnector.sendWhatsApp(phone, text).catch(() => {});
        } else if (channel === 'sms' && phone) {
          const { twilioConnector } = require('../connectors');
          const text = renderTemplate(bodyText || bodyHtml.replace(/<[^>]+>/g, ' '), vars).slice(0, 160);
          await twilioConnector.sendOTP(phone, text).catch(() => {});
        }

        await req.db.request()
          .input('cid',   sql.Int,      campId)
          .input('uid',   sql.Int,      u.Id || u.id)
          .input('email', sql.NVarChar, email)
          .input('ch',    sql.NVarChar, channel)
          .query(`INSERT INTO campaign_sends (campaign_id, user_id, email, channel, sent_at)
                  VALUES (@cid, @uid, @email, @ch, NOW())
                  ON CONFLICT (campaign_id, email) DO NOTHING`);
        sent++;
      } catch (_) {}
    }

    // Actualizar stats da campanha
    await req.db.request()
      .input('id',   sql.Int, campId)
      .input('sent', sql.Int, sent)
      .query(`UPDATE campaigns SET
        status = 'sent', sent_at = NOW(),
        total_sent = @sent, updated_at = NOW()
        WHERE id = @id`);

    console.log(`[marketing] Campanha #${campId} enviada: ${sent} mensagens`);
  } catch (err) {
    // Reverter estado em caso de erro
    await req.db.request()
      .input('id', sql.Int, campId)
      .query(`UPDATE campaigns SET status = 'draft', updated_at = NOW() WHERE id = @id`).catch(() => {});
    console.error('[marketing] Erro ao enviar campanha:', err.message);
  }
});

// ── GET /api/marketing/admin/campaigns/:id/stats ──────────────
router.get('/admin/campaigns/:id/stats', async (req, res) => {
  try {
    const camp = (await req.db.request()
      .input('id', sql.Int, Number(req.params.id))
      .query(`SELECT c.*, s.name AS segment_name FROM campaigns c
              LEFT JOIN marketing_segments s ON s.id = c.segment_id
              WHERE c.id = @id`)).recordset[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

    const sends = (await req.db.request()
      .input('id', sql.Int, Number(req.params.id))
      .query(`SELECT email, sent_at, opened_at, clicked_at, bounce
              FROM campaign_sends WHERE campaign_id = @id ORDER BY sent_at DESC LIMIT 100`)).recordset;

    res.json({ campaign: camp, sends, total: sends.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/marketing/admin/rules — Regras de automação ─────
router.get('/admin/rules', async (req, res) => {
  try {
    const r = await req.db.request().query('SELECT * FROM automation_rules ORDER BY id');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/marketing/admin/rules — Criar regra ─────────────
router.post('/admin/rules', async (req, res) => {
  const { name, trigger_event, delay_hours = 0, channel = 'email', subject, body_html, body_text, condition_sql } = req.body;
  if (!name || !trigger_event) return res.status(400).json({ error: 'name e trigger_event obrigatórios' });

  try {
    const r = await req.db.request()
      .input('name',    sql.NVarChar, name)
      .input('trigger', sql.NVarChar, trigger_event)
      .input('delay',   sql.Int,      delay_hours)
      .input('channel', sql.NVarChar, channel)
      .input('subject', sql.NVarChar, subject || null)
      .input('html',    sql.NVarChar, body_html || null)
      .input('text',    sql.NVarChar, body_text || null)
      .input('cond',    sql.NVarChar, condition_sql || null)
      .query(`INSERT INTO automation_rules (name, trigger_event, delay_hours, channel, subject, body_html, body_text, condition_sql, active, created_at)
              VALUES (@name, @trigger, @delay, @channel, @subject, @html, @text, @cond, TRUE, NOW())
              RETURNING id`);
    res.json({ ok: true, id: r.recordset[0]?.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/marketing/admin/rules/:id — Editar/activar regra ─
router.put('/admin/rules/:id', async (req, res) => {
  const { active, name, subject, body_html, body_text, delay_hours } = req.body;
  try {
    await req.db.request()
      .input('id',      sql.Int,      Number(req.params.id))
      .input('active',  sql.Bit,      active !== undefined ? (active ? 1 : 0) : null)
      .input('name',    sql.NVarChar, name    || null)
      .input('subject', sql.NVarChar, subject || null)
      .input('html',    sql.NVarChar, body_html  || null)
      .input('text',    sql.NVarChar, body_text  || null)
      .input('delay',   sql.Int,      delay_hours !== undefined ? delay_hours : null)
      .query(`UPDATE automation_rules SET
        active       = COALESCE(NULLIF(@active, -1), active),
        name         = COALESCE(@name, name),
        subject      = COALESCE(@subject, subject),
        body_html    = COALESCE(@html, body_html),
        body_text    = COALESCE(@text, body_text),
        delay_hours  = COALESCE(@delay, delay_hours)
        WHERE id = @id`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/marketing/admin/leads ───────────────────────────
router.get('/admin/leads', async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const r = await req.db.request()
      .input('limit',  sql.Int, Number(limit))
      .input('offset', sql.Int, offset)
      .query(`SELECT * FROM leads ORDER BY created_at DESC LIMIT @limit OFFSET @offset`);
    const total = (await req.db.request().query('SELECT COUNT(*) AS n FROM leads')).recordset[0].n;
    res.json({ leads: r.recordset, total, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/marketing/admin/leads/:id/convert — Marcar lead convertido ─
router.post('/admin/leads/:id/convert', async (req, res) => {
  try {
    await req.db.request()
      .input('id', sql.Int, Number(req.params.id))
      .query('UPDATE leads SET converted = TRUE WHERE id = @id');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
