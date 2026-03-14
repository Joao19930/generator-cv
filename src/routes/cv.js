// src/routes/cv.js
// ─────────────────────────────────────────────────────────────
// CRUD de CVs + geração PDF + score ATS + melhoria com IA
// ─────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const { sql }  = require('../config/database');
const multer   = require('multer');
const { openaiConnector, pdfConnector, s3Connector,
        cloudinaryConnector, emailConnector, smtpConnector,
        gaConnector, mixpanelConnector } = require('../connectors');
const { auth, premiumOnly } = require('../middleware/auth');
const { toolLimiter }       = require('../middleware/rateLimiter');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── GET /api/cv — Listar CVs do utilizador ───────────────────
router.get('/', auth, async (req, res) => {
  try {
    const result = await req.db.request().input('userId', sql.Int, req.user.id)
      .query(`SELECT id, title, template_name, template_id, content_json, created_at, updated_at, downloaded, download_count, is_public, slug, ats_score
              FROM cvs WHERE user_id = @userId ORDER BY updated_at DESC`);
    res.json({ cvs: result.recordset });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/cv/:id — Obter CV por ID ────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.db.request()
      .input('id',     sql.Int, req.params.id)
      .input('userId', sql.Int, req.user.id)
      .query(`SELECT id, title, template_name, template_id, content_json, created_at, updated_at, is_public, slug
              FROM cvs WHERE id = @id AND user_id = @userId`);
    if (!result.recordset.length) return res.status(404).json({ error: 'CV não encontrado' });
    const cv = result.recordset[0];
    if (cv.ContentJson) {
      try { cv.Content = JSON.parse(cv.ContentJson); } catch(_) { cv.Content = {}; }
    }
    res.json(cv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv — Criar novo CV ─────────────────────────────
router.post('/', auth, async (req, res) => {
  const { title, templateId, templateName, contentJson } = req.body;
  if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

  try {
    const slug   = `${title.toLowerCase().replace(/[^a-z0-9]/g,'-')}-${Date.now()}`;
    const result = await req.db.request()
      .input('userId',       sql.Int,      req.user.id)
      .input('title',        sql.NVarChar, title)
      .input('templateId',   sql.Int,      templateId || 1)
      .input('templateName', sql.NVarChar, templateName || 'Clássico')
      .input('content',      sql.NVarChar, JSON.stringify(contentJson || {}))
      .input('slug',         sql.NVarChar, slug)
      .query(`INSERT INTO cvs (user_id, title, template_id, template_name, content_json, slug, created_at, updated_at)
              VALUES (@userId, @title, @templateId, @templateName, @content, @slug, NOW(), NOW())
              RETURNING id, title, slug`);

    const cv = result.recordset[0];
    gaConnector.cvCreated(req.user.id).catch(() => {});
    mixpanelConnector.track('cv_created', req.user.id, { template: templateName });
    res.status(201).json(cv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/cv/:id — Actualizar CV ─────────────────────────
router.put('/:id', auth, async (req, res) => {
  const { title, contentJson, content, templateName, templateId } = req.body;
  const dataToSave = contentJson || content;
  try {
    await req.db.request()
      .input('id',           sql.Int,      req.params.id)
      .input('userId',       sql.Int,      req.user.id)
      .input('title',        sql.NVarChar, title || null)
      .input('content',      sql.NVarChar, dataToSave ? JSON.stringify(dataToSave) : null)
      .input('templateName', sql.NVarChar, templateName || null)
      .input('templateId',   sql.Int,      templateId   || null)
      .query(`UPDATE cvs SET
              title         = COALESCE(@title,        title),
              content_json  = COALESCE(@content,      content_json),
              template_name = COALESCE(@templateName, template_name),
              template_id   = COALESCE(@templateId,   template_id),
              updated_at    = NOW()
              WHERE id = @id AND user_id = @userId`);
    res.json({ updated: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/cv/:id ───────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await req.db.request()
      .input('id', sql.Int, req.params.id).input('userId', sql.Int, req.user.id)
      .query('DELETE FROM cvs WHERE id = @id AND user_id = @userId');
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/:id/generate-pdf — Gerar PDF ───────────────
router.post('/:id/generate-pdf', auth, async (req, res) => {
  try {
    const cv = (await req.db.request().input('id', sql.Int, req.params.id).input('userId', sql.Int, req.user.id)
      .query('SELECT * FROM cvs WHERE id = @id AND user_id = @userId')).recordset[0];
    if (!cv) return res.status(404).json({ error: 'CV não encontrado' });

    // Verificar limite free (max 1 download sem marca d'água)
    if (req.user.plan === 'free' && cv.DownloadCount >= 1)
      return res.status(402).json({ error: 'Limite atingido. Faça upgrade para Premium.', upgrade: `${process.env.APP_URL}/pricing` });

    const content = JSON.parse(cv.ContentJson || '{}');
    const html    = buildCVHtml(content, cv.TemplateName);
    const pdfBuf  = await pdfConnector.fromHTML(html);

    // Upload para S3
    const key = await s3Connector.upload(pdfBuf, `${cv.Slug}.pdf`, req.user.id);
    const url  = await s3Connector.getUrl(key, 3600);

    // Actualizar contador
    await req.db.request().input('id', sql.Int, cv.Id).input('key', sql.NVarChar, key)
      .query('UPDATE cvs SET downloaded=TRUE, download_count=download_count+1, s3_key=@key WHERE id=@id');

    // E-mail com link
    const user = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT name, email FROM users WHERE id = @id')).recordset[0];
    emailConnector.sendCVReady(user.Email, user.Name, url)
      .catch(() => smtpConnector.send(user.Email, 'O seu CV está pronto!', `<p>Olá ${user.Name}, o seu CV está pronto: <a href="${url}">Descarregar</a></p>`));

    gaConnector.track(req.user.id, 'cv_downloaded');
    res.json({ url, expires_in: 3600 });
  } catch (err) {
    console.error('generate-pdf:', err.message);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// ── POST /api/cv/improve-text — IA: melhorar texto ──────────
router.post('/improve-text', auth, toolLimiter, async (req, res) => {
  const { text, jobTitle } = req.body;
  if (!text || !jobTitle) return res.status(400).json({ error: 'text e jobTitle são obrigatórios' });
  try {
    const improved = await openaiConnector.improveText(text, jobTitle);
    res.json({ improved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/generate-cover-letter — carta de apresentação ──
router.post('/generate-cover-letter', auth, premiumOnly, toolLimiter, async (req, res) => {
  const { name, role, company, years, skills, type } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name e role são obrigatórios' });
  try {
    // Tentar via OpenAI; se falhar (quota/sem chave), usa gerador local
    let letter;
    try {
      letter = await openaiConnector.generateCoverLetter({ name, role, company, years, skills, type });
    } catch (_aiErr) {
      letter = generateCoverLetterLocal({ name, role, company, years, skills, type });
    }
    res.json({ letter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function generateCoverLetterLocal({ name, role, company, years, skills, type }) {
  const today = new Date().toLocaleDateString('pt-AO', { day: 'numeric', month: 'long', year: 'numeric' });
  const companyLine = company ? `à ${company}` : 'à vossa organização';
  const yearsLine   = years   ? `Conto com ${years} anos de experiência profissional` : 'Tenho experiência profissional relevante';
  const skillsLine  = skills  ? `As minhas principais competências incluem: ${skills}.` : '';

  const templates = {
    emprego: `${name}
${today}

Exmo(a). Senhor(a) Responsável de Recursos Humanos,

Venho por este meio candidatar-me à vaga de ${role} ${companyLine}, com grande entusiasmo e motivação.

${yearsLine} na área de ${role}, durante a qual desenvolvi sólidas competências técnicas e interpessoais. ${skillsLine}

Acredito que o meu perfil está alinhado com os requisitos da função e que poderei contribuir de forma significativa para os objectivos da organização. Estou disponível para qualquer esclarecimento adicional e para uma entrevista no momento que for mais conveniente.

Agradeço desde já a atenção dispensada à minha candidatura.

Com os melhores cumprimentos,
${name}`,

    espontanea: `${name}
${today}

Exmo(a). Senhor(a) Responsável de Recursos Humanos,

Escrevo-lhe com o intuito de me candidatar espontaneamente a uma posição de ${role} ${companyLine}.

${yearsLine} e acompanho de perto o trabalho desenvolvido pela vossa organização, que admiro pela sua visão e impacto. ${skillsLine}

Estaria muito interessado(a) em explorar oportunidades de colaboração, mesmo que não exista uma vaga em aberto neste momento. Estou disponível para uma conversa informal sempre que for oportuno.

Agradeço a disponibilidade e aguardo o vosso contacto.

Com os melhores cumprimentos,
${name}`,

    estagio: `${name}
${today}

Exmo(a). Senhor(a) Responsável de Recursos Humanos,

Venho por este meio manifestar o meu interesse em integrar um programa de estágio na área de ${role} ${companyLine}.

Encontro-me numa fase de desenvolvimento académico e profissional, e considero que a vossa organização representa uma oportunidade única de aprendizagem. ${skillsLine}

Sou uma pessoa proactiva, com forte vontade de aprender e contribuir. Estou disponível para uma entrevista e para apresentar o meu percurso académico em detalhe.

Agradeço a consideração da minha candidatura.

Com os melhores cumprimentos,
${name}`,

    promocao: `${name}
${today}

Exmo(a). Senhor(a) Director(a),

Venho por este meio expressar o meu interesse na promoção para o cargo de ${role}.

${yearsLine} nesta organização, durante os quais me dediquei com empenho às minhas funções. ${skillsLine}

Acredito que estou preparado(a) para assumir novas responsabilidades e contribuir ainda mais para os objectivos da equipa. Ficaria muito grato(a) pela oportunidade de discutir esta candidatura interna.

Com os melhores cumprimentos,
${name}`,

    mudanca: `${name}
${today}

Exmo(a). Senhor(a) Responsável de Recursos Humanos,

Escrevo-lhe com o propósito de me candidatar à posição de ${role} ${companyLine}, no âmbito de uma transição de carreira que tenho vindo a preparar com determinação.

${yearsLine} noutras áreas, o que me conferiu uma perspectiva única e competências transferíveis valiosas. ${skillsLine}

Estou motivado(a) a aplicar toda a minha experiência nesta nova área e acredito que a minha polivalência será uma mais-valia para a equipa.

Fico ao dispor para uma entrevista.

Com os melhores cumprimentos,
${name}`,

    linkedin: `Olá,

O meu nome é ${name} e sou profissional na área de ${role}. ${yearsLine} e fiquei muito impressionado(a) com o trabalho que ${company || 'a vossa organização'} tem desenvolvido.

${skillsLine}

Gostaria de me conectar consigo para trocar ideias e explorar possíveis sinergias. Acredito que poderia haver oportunidades interessantes de colaboração.

Fico à disposição para uma conversa.

Cumprimentos,
${name}`
  };

  return templates[type] || templates.emprego;
}

// ── POST /api/cv/generate-summary — IA: gerar resumo ────────
router.post('/generate-summary', auth, toolLimiter, async (req, res) => {
  const { name, jobTitle, experiences } = req.body;
  try {
    const summary = await openaiConnector.generateSummary(name, jobTitle, experiences);
    res.json({ summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/ats-score — Score ATS público ──────────────
router.post('/ats-score', toolLimiter, async (req, res) => {
  const { cvText, jobDescription, email } = req.body;
  if (!cvText || !jobDescription)
    return res.status(400).json({ error: 'cvText e jobDescription são obrigatórios' });
  try {
    const score = await openaiConnector.atsScore(cvText, jobDescription);
    // Capturar lead se e-mail fornecido
    if (email) {
      req.db.request().input('email', sql.NVarChar, email).input('score', sql.Int, score.score)
        .query(`INSERT INTO leads (email, ats_score, source, created_at) VALUES (@email, @score, 'ats_tool', NOW()) ON CONFLICT (email) DO NOTHING`).catch(() => {});
      const { zapierConnector: zap } = require('../connectors');
      zap.onLead(email, score.score);
    }
    res.json(score);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/:id/upload-photo — Foto de perfil ──────────
router.post('/:id/upload-photo', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' });
  try {
    const fs   = require('fs');
    const path = require('path');
    const tmp  = path.join('/tmp', `${Date.now()}-${req.file.originalname}`);
    fs.writeFileSync(tmp, req.file.buffer);
    const result = await cloudinaryConnector.uploadPhoto(tmp, req.user.id);
    fs.unlinkSync(tmp);

    await req.db.request().input('id', sql.Int, req.params.id).input('userId', sql.Int, req.user.id)
      .input('url', sql.NVarChar, result.secure_url)
      .query(`UPDATE cvs SET content_json = jsonb_set(content_json::jsonb, '{photoUrl}', to_json(@url::text)::jsonb)::text WHERE id=@id AND user_id=@userId`);

    res.json({ url: result.secure_url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Helper: construir HTML do CV ─────────────────────────────
function buildCVHtml(content, templateName) {
  const { name='', jobTitle='', summary='', email='', phone='', address='',
          experiences=[], education=[], skills=[], languages=[], photoUrl='' } = content;

  const nl2br = t => (t||'').replace(/\n/g, '<br>');
  const expHtml = experiences.map(e =>
    `<div class="exp"><h4>${e.title} — ${e.company}</h4><span>${e.startDate} – ${e.endDate || 'Presente'}</span><p>${nl2br(e.description)}</p></div>`).join('');
  const eduHtml = education.map(e =>
    `<div class="edu"><h4>${e.degree} — ${e.institution}</h4><span>${e.year}</span></div>`).join('');
  const skillHtml = skills.map(s => `<span class="tag">${s}</span>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:20px}
    h1{font-size:22px;margin:0} h2{font-size:14px;border-bottom:2px solid #2563eb;padding-bottom:4px;color:#2563eb}
    h3{font-size:13px;margin:0;color:#555} h4{margin:0 0 2px}
    .header{display:flex;align-items:center;gap:16px;margin-bottom:16px}
    .photo{width:80px;height:80px;border-radius:50%;object-fit:cover}
    .contact{font-size:11px;color:#555} .tag{background:#e0e7ff;padding:2px 8px;border-radius:12px;margin:2px;font-size:11px;display:inline-block}
    .exp,.edu{margin-bottom:10px} span{font-size:11px;color:#777}
    section{margin-bottom:14px}
  </style></head><body>
  <div class="header">
    ${photoUrl ? `<img class="photo" src="${photoUrl}" />` : ''}
    <div><h1>${name}</h1><h3>${jobTitle}</h3>
    <div class="contact">${email} ${phone ? '| '+phone : ''} ${address ? '| '+address : ''}</div></div>
  </div>
  ${summary ? `<section><h2>Resumo</h2><p>${nl2br(summary)}</p></section>` : ''}
  ${experiences.length ? `<section><h2>Experiência</h2>${expHtml}</section>` : ''}
  ${education.length   ? `<section><h2>Educação</h2>${eduHtml}</section>`   : ''}
  ${skills.length      ? `<section><h2>Competências</h2>${skillHtml}</section>` : ''}
  </body></html>`;
}

module.exports = router;
