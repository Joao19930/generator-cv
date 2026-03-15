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

// ── POST /api/cv/generate-cover-letter-pdf — PDF da carta ───────
router.post('/generate-cover-letter-pdf', auth, premiumOnly, async (req, res) => {
  const { letterText, template = 'classico', name = '' } = req.body;
  if (!letterText) return res.status(400).json({ error: 'letterText é obrigatório' });
  try {
    const html = buildCoverLetterHtml(letterText, template, name);
    const pdfBuf = await pdfConnector.fromHTML(html);
    const slug = `carta-${req.user.id}-${Date.now()}`;
    const key  = await s3Connector.upload(pdfBuf, `${slug}.pdf`, req.user.id);
    const url  = await s3Connector.getUrl(key, 3600);
    res.json({ url, expires_in: 3600 });
  } catch (err) {
    console.error('cover-letter-pdf:', err.message);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

function buildCoverLetterHtml(letterText, template, name) {
  const lines = letterText.split('\n');
  const bodyHtml = lines.map(l => l.trim() === '' ? '<br>' : `<p>${l}</p>`).join('');

  const templates = {
    classico: `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Times New Roman',serif;font-size:12pt;color:#1a1a1a;background:#fff;padding:0;}
  .header{background:#1e3a5f;color:#fff;padding:36px 48px 28px;}
  .header-name{font-size:22pt;font-weight:700;letter-spacing:.5px;}
  .header-sub{font-size:10pt;opacity:.75;margin-top:6px;}
  .body{padding:40px 48px;}
  p{margin-bottom:14px;line-height:1.75;text-align:justify;}
  .footer{border-top:2px solid #1e3a5f;margin:32px 48px 0;padding-top:12px;font-size:9pt;color:#666;text-align:center;}
</style></head><body>
<div class="header"><div class="header-name">${name || 'Carta de Apresentação'}</div><div class="header-sub">Carta de Apresentação Profissional</div></div>
<div class="body">${bodyHtml}</div>
<div class="footer">Documento gerado via CV Premium · cvpremium.net</div>
</body></html>`,

    moderno: `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a1a;background:#fff;display:flex;min-height:100vh;}
  .sidebar{width:8px;background:linear-gradient(180deg,#2563eb,#7c3aed);flex-shrink:0;}
  .content{flex:1;padding:44px 52px;}
  .top{border-bottom:1px solid #e2e8f0;padding-bottom:18px;margin-bottom:28px;}
  .top-name{font-size:20pt;font-weight:700;color:#2563eb;}
  .top-sub{font-size:9pt;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.8px;}
  p{margin-bottom:14px;line-height:1.75;text-align:justify;}
  .footer{margin-top:32px;font-size:8.5pt;color:#94a3b8;text-align:right;}
</style></head><body>
<div class="sidebar"></div>
<div class="content">
  <div class="top"><div class="top-name">${name || 'Carta de Apresentação'}</div><div class="top-sub">Carta de Apresentação</div></div>
  ${bodyHtml}
  <div class="footer">CV Premium · cvpremium.net</div>
</div></body></html>`,

    minimalista: `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11pt;color:#374151;background:#fff;padding:60px 72px;}
  .name{font-size:18pt;font-weight:300;color:#111;letter-spacing:1px;margin-bottom:4px;}
  .line{width:40px;height:2px;background:#374151;margin-bottom:36px;}
  p{margin-bottom:16px;line-height:1.8;text-align:justify;}
  .footer{margin-top:48px;font-size:8.5pt;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px;}
</style></head><body>
<div class="name">${name || 'Carta de Apresentação'}</div>
<div class="line"></div>
${bodyHtml}
<div class="footer">CV Premium · cvpremium.net</div>
</body></html>`,

    executivo: `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Georgia,serif;font-size:11.5pt;color:#1a1a1a;background:#fff;padding:0;}
  .header{background:#0f172a;color:#fff;padding:40px 52px;display:flex;justify-content:space-between;align-items:flex-end;}
  .header-name{font-size:21pt;font-weight:700;letter-spacing:.5px;}
  .header-badge{font-size:8pt;background:#c9a227;color:#0f172a;padding:4px 12px;border-radius:2px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
  .body{padding:44px 52px;}
  p{margin-bottom:15px;line-height:1.8;text-align:justify;}
  .footer{margin:0 52px;border-top:3px double #0f172a;padding-top:12px;font-size:8.5pt;color:#64748b;display:flex;justify-content:space-between;}
</style></head><body>
<div class="header"><div class="header-name">${name || 'Carta de Apresentação'}</div><div class="header-badge">Carta de Apresentação</div></div>
<div class="body">${bodyHtml}</div>
<div class="footer"><span>Documento Confidencial</span><span>CV Premium · cvpremium.net</span></div>
</body></html>`
  };

  return templates[template] || templates.classico;
}

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
    let summary;
    try { summary = await openaiConnector.generateSummary(name, jobTitle, experiences); }
    catch { summary = generateSummaryLocal(name, jobTitle, experiences); }
    res.json({ summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/generate-responsibilities — IA: sugerir responsabilidades ──
router.post('/generate-responsibilities', auth, toolLimiter, async (req, res) => {
  const { jobTitle } = req.body;
  if (!jobTitle) return res.status(400).json({ error: 'jobTitle é obrigatório' });
  try {
    let responsibilities;
    try { responsibilities = await openaiConnector.generateResponsibilities(jobTitle); }
    catch { responsibilities = generateResponsibilitiesLocal(jobTitle); }
    res.json({ responsibilities });
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

function generateSummaryLocal(name, jobTitle, experiences) {
  const n = name || 'o candidato';
  const j = jobTitle || 'profissional';
  const expNote = experiences ? ` com experiência em ${experiences.slice(0, 80)}` : '';
  return `${n} é um(a) ${j} dedicado(a)${expNote}. Orientado(a) para resultados, com forte capacidade de trabalho em equipa e resolução de problemas. Comprometido(a) com a excelência profissional e o desenvolvimento contínuo. Disponível para novos desafios e para contribuir para o crescimento da organização.`;
}

function generateResponsibilitiesLocal(jobTitle) {
  const jt = (jobTitle || '').toLowerCase();
  const maps = [
    { rx: /motorista|condutor|driver/,         items: ['Condução segura de veículos da empresa', 'Cumprimento das rotas e horários estabelecidos', 'Manutenção básica e verificação do estado do veículo', 'Transporte de mercadorias e/ou passageiros', 'Registo de quilómetros e ocorrências de viagem', 'Cumprimento do código da estrada e normas de segurança'] },
    { rx: /cozinheiro|chef|cozinha|pasteleiro/, items: ['Preparação e confecção de refeições conforme o menu', 'Controlo de qualidade e higiene alimentar', 'Gestão de stocks e encomenda de ingredientes', 'Organização e limpeza da área de trabalho', 'Criação de novas receitas e sugestões do dia', 'Cumprimento das normas HACCP'] },
    { rx: /contabilist|financ|auditor/,         items: ['Registo e lançamento de documentos contabilísticos', 'Elaboração de relatórios financeiros mensais', 'Controlo e reconciliação de contas bancárias', 'Cumprimento das obrigações fiscais e declarativas', 'Análise de custos e apoio à gestão orçamental', 'Arquivo e organização da documentação contabilística'] },
    { rx: /vendedor|comercial|sales/,           items: ['Prospeção e captação de novos clientes', 'Apresentação e demonstração de produtos/serviços', 'Negociação e fecho de vendas', 'Acompanhamento e fidelização da carteira de clientes', 'Registo de actividades no CRM', 'Cumprimento das metas comerciais mensais'] },
    { rx: /electricista|electric/,             items: ['Instalação e manutenção de sistemas eléctricos', 'Diagnóstico e resolução de avarias eléctricas', 'Leitura e interpretação de esquemas eléctricos', 'Instalação de quadros eléctricos e cablagens', 'Cumprimento das normas de segurança eléctrica', 'Registo de intervenções técnicas realizadas'] },
    { rx: /professor|docente|ensino/,           items: ['Planificação e leccionação de aulas', 'Avaliação contínua e sumativa dos alunos', 'Elaboração de materiais pedagógicos', 'Acompanhamento individualizado dos alunos', 'Participação em reuniões pedagógicas', 'Comunicação regular com os encarregados de educação'] },
    { rx: /rh|recursos humanos|recrutamento/,   items: ['Recrutamento e selecção de candidatos', 'Gestão de admissões, contratos e documentação', 'Controlo de assiduidade e gestão de férias', 'Elaboração de processos de avaliação de desempenho', 'Organização de acções de formação interna', 'Apoio ao cumprimento da legislação laboral'] },
    { rx: /marketing|digital|social media/,     items: ['Gestão das redes sociais da empresa', 'Criação de conteúdos e campanhas digitais', 'Análise de métricas e relatórios de desempenho', 'Gestão de tráfego pago (Meta Ads, Google Ads)', 'Desenvolvimento de estratégias de marketing de conteúdo', 'Coordenação com fornecedores criativos e agências'] },
    { rx: /engenheir|engineer/,                 items: ['Desenvolvimento e acompanhamento de projectos técnicos', 'Elaboração de relatórios e documentação técnica', 'Supervisão de obras e equipas no terreno', 'Controlo de qualidade e cumprimento de normas', 'Resolução de problemas técnicos complexos', 'Coordenação com clientes e fornecedores'] },
  ];
  const match = maps.find(m => m.rx.test(jt));
  const items = match ? match.items : [
    `Execução das funções inerentes ao cargo de ${jobTitle}`,
    'Colaboração com a equipa para atingir os objectivos da empresa',
    'Elaboração de relatórios de actividades e resultados',
    'Cumprimento dos procedimentos internos e normas de qualidade',
    'Atendimento e apoio a clientes/parceiros conforme necessário',
    'Participação em formações e actividades de melhoria contínua',
  ];
  return items.map(i => `• ${i}`).join('\n');
}

module.exports = router;
