// src/cron/jobs.js
// ─────────────────────────────────────────────────────────────
// CRON Jobs: drip e-mails, expiração de planos, cache cleanup,
//            automação comportamental de marketing
// ─────────────────────────────────────────────────────────────
const cron  = require('node-cron');
const { sql } = require('../config/database');
const { smtpConnector, emailConnector, redisConnector, twilioConnector } = require('../connectors');
const { importJobs } = require('../routes/empregos');
const crypto = require('crypto');

// ── Agendar drip e-mails de onboarding ───────────────────────
const scheduleDrip = async (pool, userId, email, name) => {
  const emails = [
    { day: 0,  subject: `${name}, o seu CV profissional está pronto`,        tpl: 'welcome'  },
    { day: 2,  subject: '3 segredos que os recrutadores não revelam sobre CVs', tpl: 'tips'   },
    { day: 5,  subject: 'O seu CV está a 1 passo de ficar perfeito',           tpl: 'upgrade' },
    { day: 10, subject: `${name}, não abandone o seu CV agora...`,             tpl: 'reengage'},
    { day: 20, subject: 'Última chamada: 50% de desconto só hoje',             tpl: 'discount'}
  ];

  for (const e of emails) {
    const scheduledAt = new Date(Date.now() + e.day * 86400000);
    await pool.request()
      .input('userId',      sql.Int,      userId)
      .input('email',       sql.NVarChar, email)
      .input('subject',     sql.NVarChar, e.subject)
      .input('template',    sql.NVarChar, e.tpl)
      .input('scheduledAt', sql.DateTime, scheduledAt)
      .query(`INSERT INTO email_queue (user_id, email, subject, template, scheduled_at, sent, created_at)
              VALUES (@userId, @email, @subject, @template, @scheduledAt, FALSE, NOW())`).catch(() => {});
  }
};

// ── Processar fila de e-mails (chamado pelo CRON) ─────────────
const processEmailQueue = async (pool) => {
  const due = await pool.request().query(`
    SELECT id, email, subject, template, user_id
    FROM email_queue WHERE sent=FALSE AND scheduled_at <= NOW()
    LIMIT 50
  `).catch(() => ({ recordset: [] }));

  const tplHtml = {
    welcome:  (name) => `<h2>Bem-vindo ao CV Premium, ${name}!</h2><p>A sua conta está pronta.</p><a href="${process.env.APP_URL}/editor" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Criar o meu CV</a>`,
    tips:     ()     => `<h2>3 Segredos de CV dos Recrutadores</h2><ul><li>Use palavras-chave da vaga</li><li>Quantifique resultados</li><li>Máximo 1 página</li></ul><a href="${process.env.APP_URL}/editor">Melhorar o meu CV</a>`,
    upgrade:  ()     => `<h2>Desbloqueie tudo no Premium</h2><p>Remova marcas d'água, aceda a todos os templates e descarregue ilimitadamente.</p><a href="${process.env.APP_URL}/pricing" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Ver Planos</a>`,
    reengage: (name) => `<h2>${name}, o seu CV está à espera</h2><p>Não deixe o seu CV incompleto. Os recrutadores procuram candidatos como você agora mesmo.</p><a href="${process.env.APP_URL}/editor">Continuar o meu CV</a>`,
    discount: ()     => `<h2>50% de desconto — só hoje!</h2><p>Use o código <strong>CV50</strong> no checkout para obter metade do preço do Premium.</p><a href="${process.env.APP_URL}/pricing?code=CV50">Resgatar oferta</a>`
  };

  for (const row of due.recordset) {
    try {
      const user = (await pool.request().input('id', sql.Int, row.UserId || row.user_id)
        .query('SELECT name FROM users WHERE id=@id')).recordset[0];
      const name = user?.Name || user?.name || '';
      const html = (tplHtml[row.Template || row.template] || (() => `<p>${row.Subject || row.subject}</p>`))(name);

      await emailConnector.sendWelcome(row.Email || row.email, name).catch(() =>
        smtpConnector.send(row.Email || row.email, row.Subject || row.subject, html));

      await pool.request().input('id', sql.Int, row.Id || row.id)
        .query('UPDATE email_queue SET sent=TRUE, sent_at=NOW() WHERE id=@id');
    } catch (_) {}
  }
  if (due.recordset.length) console.log(`Drip: ${due.recordset.length} e-mails enviados`);
};

// ── Expirar planos Premium vencidos ──────────────────────────
const expirePlans = async (pool) => {
  const r = await pool.request()
    .query(`UPDATE users SET plan='free'
            WHERE plan_expiry < NOW() AND plan != 'free'
            RETURNING id`)
    .catch(() => ({ recordset: [] }));
  const n = r.recordset ? r.recordset.length : 0;
  if (n) {
    console.log(`${n} planos Premium expirados`);
    await redisConnector.del('admin:overview').catch(() => {});
  }
};

// ── Garantir token de unsubscribe para todos os utilizadores ──
const ensureUnsubTokens = async (pool) => {
  try {
    const users = await pool.request()
      .query(`SELECT id FROM users WHERE unsubscribe_token IS NULL LIMIT 500`).catch(() => ({ recordset: [] }));
    for (const u of users.recordset) {
      const token = crypto.randomBytes(16).toString('hex');
      await pool.request()
        .input('id', sql.Int, u.Id || u.id)
        .input('token', sql.NVarChar, token)
        .query(`UPDATE users SET unsubscribe_token = @token WHERE id = @id`).catch(() => {});
    }
    if (users.recordset.length) console.log(`[marketing] ${users.recordset.length} tokens de unsubscribe gerados`);
  } catch (_) {}
};

// ── Enviar e-mail de automação (com fallback SMTP) ────────────
const sendAutomationEmail = async (to, subject, html) => {
  try {
    const sg = require('@sendgrid/mail');
    sg.setApiKey(process.env.SENDGRID_API_KEY);
    await sg.send({ to, from: { email: process.env.EMAIL_FROM || 'noreply@cvpremium.net', name: 'CV Premium' }, subject, html });
  } catch (_) {
    await smtpConnector.send(to, subject, html).catch(() => {});
  }
};

// ── Renderizar template de automação ─────────────────────────
const renderAutomation = (tpl, vars) =>
  (tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');

const wrapAutomationEmail = (content, unsubUrl) => `
<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>body{margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif}
.wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center}
.header h1{color:#fff;margin:0;font-size:22px}.header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px}
.body{padding:32px 40px}.body p{color:#374151;line-height:1.7;margin:0 0 16px;font-size:15px}
.btn{display:inline-block;margin:8px 0 24px;padding:14px 32px;background:#2563eb;color:#fff!important;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px}
.highlight{background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0}
.footer{background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb}
.footer p{color:#9ca3af;font-size:12px;margin:0}</style></head>
<body><div class="wrap">
<div class="header"><h1>CV Premium</h1><p>cvpremium.net</p></div>
<div class="body">${content}</div>
<div class="footer">
<p>© ${new Date().getFullYear()} CV Premium — Luanda, Angola</p>
${unsubUrl ? `<p style="margin-top:6px"><a href="${unsubUrl}" style="color:#9ca3af;font-size:11px">Cancelar subscrição de e-mails</a></p>` : ''}
</div></div></body></html>`;

// ── Automação comportamental — processar regras ───────────────
const processAutomationRules = async (pool) => {
  const APP_URL = process.env.APP_URL || 'https://cvpremium.net';

  try {
    // Obter todas as regras activas
    const rules = await pool.request()
      .query(`SELECT * FROM automation_rules WHERE active = TRUE`).catch(() => ({ recordset: [] }));

    for (const rule of rules.recordset) {
      const ruleId    = rule.Id || rule.id;
      const trigger   = rule.TriggerEvent || rule.trigger_event;
      const delay     = rule.DelayHours   || rule.delay_hours || 0;
      const channel   = rule.Channel      || rule.channel || 'email';
      const subject   = rule.Subject      || rule.subject || 'CV Premium';
      const bodyHtml  = rule.BodyHtml     || rule.body_html || '';
      const bodyText  = rule.BodyText     || rule.body_text || '';

      let candidates = [];

      if (trigger === 'user_inactive_7d') {
        // Utilizadores inactivos há 7 dias (free sem compra recente)
        const r = await pool.request().query(`
          SELECT u.id, u.name, u.email, u.phone, u.unsubscribe_token, u.marketing_email, u.marketing_whatsapp
          FROM users u
          WHERE u.last_login < NOW() - INTERVAL '7 days'
            AND u.last_login > NOW() - INTERVAL '8 days'
            AND u.marketing_email = TRUE
            AND u.id NOT IN (
              SELECT COALESCE(user_id, 0) FROM automation_sends WHERE rule_id = ${ruleId}
            )
          LIMIT 100
        `).catch(() => ({ recordset: [] }));
        candidates = r.recordset;

      } else if (trigger === 'user_inactive_30d') {
        const r = await pool.request().query(`
          SELECT u.id, u.name, u.email, u.phone, u.unsubscribe_token, u.marketing_email, u.marketing_whatsapp
          FROM users u
          WHERE u.last_login < NOW() - INTERVAL '30 days'
            AND u.last_login > NOW() - INTERVAL '31 days'
            AND u.marketing_email = TRUE
            AND u.id NOT IN (
              SELECT COALESCE(user_id, 0) FROM automation_sends WHERE rule_id = ${ruleId}
            )
          LIMIT 100
        `).catch(() => ({ recordset: [] }));
        candidates = r.recordset;

      } else {
        // Gatilho baseado em evento da tabela user_events
        const minAge = `NOW() - INTERVAL '${delay} hours'`;
        const maxAge = `NOW() - INTERVAL '${Math.max(delay - 1, 0)} hours'`;
        const r = await pool.request().query(`
          SELECT DISTINCT u.id, u.name, u.email, u.phone, u.unsubscribe_token, u.marketing_email, u.marketing_whatsapp
          FROM user_events ue
          INNER JOIN users u ON u.id = ue.user_id
          WHERE ue.event = '${trigger}'
            AND ue.created_at <= ${minAge}
            AND ue.created_at >= ${maxAge}
            AND u.marketing_email = TRUE
            AND u.email NOT IN (
              SELECT COALESCE(email, '') FROM automation_sends WHERE rule_id = ${ruleId}
            )
          LIMIT 100
        `).catch(() => ({ recordset: [] }));
        candidates = r.recordset;
      }

      if (!candidates.length) continue;

      let sent = 0;
      for (const u of candidates) {
        const email    = u.Email || u.email;
        const name     = (u.Name || u.name || '').split(' ')[0] || 'Candidato';
        const phone    = u.Phone || u.phone;
        const unsubTkn = u.UnsubscribeToken || u.unsubscribe_token;
        const unsubUrl = unsubTkn
          ? `${APP_URL}/api/marketing/unsubscribe?token=${unsubTkn}&email=${encodeURIComponent(email)}`
          : null;

        const vars = { name, APP_URL, UNSUB_URL: unsubUrl || '' };

        try {
          if (channel === 'email' && (u.MarketingEmail ?? u.marketing_email) !== false) {
            const html = wrapAutomationEmail(renderAutomation(bodyHtml, vars), unsubUrl);
            await sendAutomationEmail(email, renderAutomation(subject, vars), html);
          } else if (channel === 'whatsapp' && phone && (u.MarketingWhatsapp ?? u.marketing_whatsapp) !== false) {
            const text = renderAutomation(bodyText || bodyHtml.replace(/<[^>]+>/g, ' '), vars).slice(0, 1000);
            await twilioConnector.sendWhatsApp(phone, text).catch(() => {});
          } else if (channel === 'sms' && phone) {
            const text = renderAutomation(bodyText || bodyHtml.replace(/<[^>]+>/g, ' '), vars).slice(0, 160);
            await twilioConnector.sendSMS(phone, text).catch(() => {});
          }

          await pool.request()
            .input('ruleId', sql.Int, ruleId)
            .input('userId', sql.Int, u.Id || u.id)
            .input('email',  sql.NVarChar, email)
            .query(`INSERT INTO automation_sends (rule_id, user_id, email, triggered_at, sent_at)
                    VALUES (@ruleId, @userId, @email, NOW(), NOW())
                    ON CONFLICT (rule_id, email) DO NOTHING`);
          sent++;
        } catch (_) {}
      }

      if (sent) console.log(`[marketing] Regra "${trigger}" → ${sent} enviados`);
    }
  } catch (err) {
    console.error('[marketing] Erro na automação comportamental:', err.message);
  }
};

// ── Registar todos os CRONs ──────────────────────────────────
const setupCrons = (pool) => {
  // A cada hora: enviar e-mails agendados (drip onboarding)
  cron.schedule('0 * * * *', () => processEmailQueue(pool));

  // A cada hora: executar regras de automação comportamental
  cron.schedule('30 * * * *', () => processAutomationRules(pool));

  // Às 2h da manhã: expirar planos
  cron.schedule('0 2 * * *', () => expirePlans(pool));

  // Às 3h: garantir tokens de unsubscribe para novos utilizadores
  cron.schedule('0 3 * * *', () => ensureUnsubTokens(pool));

  // A cada 15 min: limpar cache do dashboard + marketing
  cron.schedule('*/15 * * * *', () => {
    redisConnector.del('admin:overview').catch(() => {});
    redisConnector.del('mkt:dashboard').catch(() => {});
  });

  // Às 6h: manutenção diária
  cron.schedule('0 6 * * *', () => console.log('Manutenção diária executada'));

  // A cada 6h: importar vagas de emprego
  cron.schedule('0 */6 * * *', () => {
    console.log('[empregos] A importar vagas (cron 6h)…');
    importJobs(pool).catch(e => console.error('[empregos] cron erro:', e.message));
  });

  console.log('CRON Jobs activos');
};

module.exports = { setupCrons, scheduleDrip };
