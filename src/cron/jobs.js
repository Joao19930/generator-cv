// src/cron/jobs.js
// ─────────────────────────────────────────────────────────────
// CRON Jobs: drip e-mails, expiração de planos, cache cleanup
// ─────────────────────────────────────────────────────────────
const cron  = require('node-cron');
const { sql } = require('../config/database');
const { smtpConnector, emailConnector, redisConnector } = require('../connectors');

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
    welcome:  (name) => `<h2>Bem-vindo ao CV Generator, ${name}!</h2><p>A sua conta está pronta.</p><a href="${process.env.APP_URL}/editor" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Criar o meu CV</a>`,
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

// ── Registar todos os CRONs ──────────────────────────────────
const setupCrons = (pool) => {
  // A cada hora: enviar e-mails agendados
  cron.schedule('0 * * * *', () => processEmailQueue(pool));

  // Às 2h da manhã: expirar planos
  cron.schedule('0 2 * * *', () => expirePlans(pool));

  // A cada 15 min: limpar cache do dashboard
  cron.schedule('*/15 * * * *', () => redisConnector.del('admin:overview').catch(() => {}));

  // Às 6h: manutenção diária
  cron.schedule('0 6 * * *', () => console.log('Manutenção diária executada'));

  console.log('CRON Jobs activos');
};

module.exports = { setupCrons, scheduleDrip };
