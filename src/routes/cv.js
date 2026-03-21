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
        gaConnector, mixpanelConnector, claudeAsk } = require('../connectors');
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

    const content = JSON.parse(cv.ContentJson || '{}');

    // Se template_name estiver vazio, tenta obter o slug da tabela templates
    let tplName = cv.TemplateName || cv.template_name || '';
    if (!tplName && (cv.TemplateId || cv.template_id)) {
      const tplRow = (await req.db.request()
        .input('tid', sql.Int, cv.TemplateId || cv.template_id)
        .query('SELECT slug, name FROM templates WHERE id = @tid')).recordset[0];
      if (tplRow) tplName = tplRow.slug || tplRow.Slug || tplRow.name || tplRow.Name || '';
    }
    console.log('[PDF] cv_id=%d template_name="%s" resolved="%s"', cv.Id || cv.id, cv.TemplateName, tplName);

    const html = buildCVHtml(content, tplName);
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

// ── POST /api/cv/:id/download — registar download (print) ────
router.post('/:id/download', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    // Verificar que o CV pertence ao utilizador
    const check = await req.db.request().input('id', sql.Int, id).input('uid', sql.Int, req.user.id)
      .query('SELECT id FROM cvs WHERE id=@id AND user_id=@uid');
    if (!check.recordset.length) return res.status(403).json({ error: 'Sem permissão' });
    // Incrementar contador
    await req.db.request().input('id', sql.Int, id)
      .query('UPDATE cvs SET downloaded=TRUE, download_count=COALESCE(download_count,0)+1 WHERE id=@id');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    // Tentar S3; se falhar, envia o PDF directamente
    try {
      const slug = `carta-${req.user.id}-${Date.now()}`;
      const key  = await s3Connector.upload(pdfBuf, `${slug}.pdf`, req.user.id);
      const url  = await s3Connector.getUrl(key, 3600);
      res.json({ url, expires_in: 3600 });
    } catch (_s3Err) {
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="carta-apresentacao.pdf"` });
      res.send(pdfBuf);
    }
  } catch (err) {
    console.error('cover-letter-pdf:', err.message, err.stack);
    res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
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
  const { name, role, email, phone, company, years, skills, type } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name e role são obrigatórios' });
  try {
    // Tentar via OpenAI; se falhar (quota/sem chave), usa gerador local
    let letter;
    try {
      letter = await openaiConnector.generateCoverLetter({ name, role, email, phone, company, years, skills, type });
    } catch (_aiErr) {
      letter = generateCoverLetterLocal({ name, role, email, phone, company, years, skills, type });
    }
    res.json({ letter });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function generateCoverLetterLocal({ name, role, email, phone, company, years, skills, type }) {
  const today = new Date().toLocaleDateString('pt-AO', { day: 'numeric', month: 'long', year: 'numeric' });
  const companyLine = company ? `à ${company}` : 'à vossa organização';
  const yearsLine   = years   ? `Conto com ${years} anos de experiência profissional` : 'Tenho experiência profissional relevante';
  const skillsLine  = skills  ? `As minhas principais competências incluem: ${skills}.` : '';
  const contactLine = [email, phone].filter(Boolean).join(' | ');

  const templates = {
    emprego: `${name}${contactLine ? '\n' + contactLine : ''}
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
  const { name, jobTitle, experiences, skills, sector, yearsExp } = req.body;
  try {
    let summary;
    try { summary = await openaiConnector.generateSummary(name, jobTitle, experiences, skills, sector, yearsExp); }
    catch { summary = generateSummaryLocal(name, jobTitle, experiences); }
    res.json({ summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/generate-responsibilities — IA: sugerir responsabilidades ──
router.post('/generate-responsibilities', auth, toolLimiter, async (req, res) => {
  const { jobTitle, company, sector, yearsExp } = req.body;
  if (!jobTitle) return res.status(400).json({ error: 'jobTitle é obrigatório' });
  try {
    let responsibilities;
    try { responsibilities = await openaiConnector.generateResponsibilities(jobTitle, company, sector, yearsExp); }
    catch { responsibilities = generateResponsibilitiesLocal(jobTitle); }
    res.json({ responsibilities });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/cv/parse-linkedin-text — IA: extrair perfil do texto LinkedIn ──
router.post('/parse-linkedin-text', auth, toolLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 30)
    return res.status(400).json({ error: 'Texto do perfil muito curto' });

  const prompt = `Analisa este texto copiado de um perfil LinkedIn e extrai os dados estruturados.
Devolve APENAS JSON válido, sem markdown, sem explicações, com esta estrutura exacta:
{
  "fullName": "",
  "jobTitle": "",
  "summary": "",
  "phone": "",
  "address": "",
  "linkedin": "",
  "experience": [
    { "title": "", "company": "", "start": "", "end": "", "description": "" }
  ],
  "education": [
    { "degree": "", "institution": "", "year": "" }
  ],
  "skills": []
}

Regras:
- Se um campo não existir no texto, deixa string vazia ou array vazio
- summary = secção "Sobre" ou "About" do perfil
- Para experiências, preserva as datas tal como aparecem
- Para skills, extrai palavras-chave de competências mencionadas
- Devolve no máximo 6 experiências e 5 formações

TEXTO DO PERFIL:
${text.substring(0, 6000)}`;

  try {
    const raw = await claudeAsk(prompt, 2000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'IA não devolveu JSON válido' });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/cv/ats-score — Score ATS público ──────────────
router.post('/ats-score', toolLimiter, async (req, res) => {
  const { cvText, jobDescription, email } = req.body;
  if (!cvText || !jobDescription)
    return res.status(400).json({ error: 'cvText e jobDescription são obrigatórios' });
  try {
    let score;
    try {
      score = await openaiConnector.atsScore(cvText, jobDescription);
    } catch (_aiErr) {
      score = atsScoreLocal(cvText, jobDescription);
    }
    if (email) {
      req.db.request().input('email', sql.NVarChar, email).input('score', sql.Int, score.score)
        .query(`INSERT INTO leads (email, ats_score, source, created_at) VALUES (@email, @score, 'ats_tool', NOW()) ON CONFLICT (email) DO NOTHING`).catch(() => {});
      const { zapierConnector: zap } = require('../connectors');
      zap.onLead(email, score.score);
    }
    res.json(score);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function atsScoreLocal(cvText, jobDescription) {
  const cv  = cvText.toLowerCase();
  const job = jobDescription.toLowerCase();
  const jobWords = job.match(/\b\w{4,}\b/g) || [];
  const unique = [...new Set(jobWords)].filter(w => !['para','como','com','que','uma','dos','das','por','ser','ter','mais','seus','sua'].includes(w));
  const matched = unique.filter(w => cv.includes(w));
  const keywordScore = unique.length ? Math.round((matched.length / unique.length) * 100) : 50;

  const hasEmail    = /[\w.]+@[\w.]+\.\w+/.test(cv);
  const hasPhone    = /[\+\d][\d\s\-]{7,}/.test(cv);
  const hasLinkedin = cv.includes('linkedin');
  const hasSections = ['experiência','educação','competências','formação','skills','experience'].some(s => cv.includes(s));
  const structureScore = ((hasEmail?25:0) + (hasPhone?15:0) + (hasLinkedin?10:0) + (hasSections?50:0));

  const score = Math.min(98, Math.round(keywordScore * 0.65 + structureScore * 0.35));
  const missing = unique.filter(w => !cv.includes(w)).slice(0, 5);
  const feedback = [
    `Palavras-chave encontradas: ${matched.length} de ${unique.length}.`,
    missing.length ? `Palavras em falta: ${missing.join(', ')}.` : '',
    !hasEmail    ? '⚠ Adiciona o teu e-mail ao CV.' : '',
    !hasPhone    ? '⚠ Adiciona o teu telefone ao CV.' : '',
    !hasSections ? '⚠ Organiza o CV em secções claras (Experiência, Educação, Competências).' : '',
  ].filter(Boolean).join('\n');

  return { score, feedback };
}

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
  const {
    name='', jobTitle='', summary='', email='', phone='', address='',
    linkedin='', website='',
    experiences=[], education=[], skills=[], languages=[], photoUrl=''
  } = content;

  // Normalizar: aceita slug directo ('cf-executivo-escuro') ou nome legível ('Executivo Escuro')
  // Também lê do campo content.template se templateName estiver vazio
  const rawTpl = templateName || content.template || content.templateName || '';
  const slug = rawTpl.toLowerCase().replace(/\s+/g,'-');
  const nl2br = t => (t||'').replace(/\n/g,'<br>');
  const esc   = t => String(t||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // contact line helper
  const contacts = [email, phone, address, linkedin, website].filter(Boolean);
  const contactLine = contacts.map(c => esc(c)).join(' &nbsp;·&nbsp; ');

  // experience / education blocks helpers (reused across templates)
  const expBlocks = (titleColor='#1e293b', metaColor='#64748b', dotColor='#2563eb') =>
    experiences.map(e => `
      <div style="margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:${titleColor};">${esc(e.title)}${e.company ? ` — ${esc(e.company)}` : ''}</div>
        <div style="font-size:11px;color:${metaColor};margin:2px 0 6px;">${esc(e.startDate||'')}${e.endDate ? ` – ${esc(e.endDate)}` : ' – Presente'}</div>
        ${e.description ? `<div style="font-size:11.5px;color:#475569;line-height:1.6;">${nl2br(esc(e.description))}</div>` : ''}
      </div>`).join('');

  const eduBlocks = (titleColor='#1e293b', metaColor='#64748b') =>
    education.map(e => `
      <div style="margin-bottom:10px;">
        <div style="font-size:12.5px;font-weight:700;color:${titleColor};">${esc(e.degree||e.course||'')}${e.institution ? ` — ${esc(e.institution)}` : ''}</div>
        <div style="font-size:11px;color:${metaColor};">${esc(e.year||e.startDate||'')}</div>
      </div>`).join('');

  const skillTags = (bg='#e0e7ff', color='#3730a3') =>
    skills.map(s => `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:12px;font-size:10.5px;display:inline-block;margin:2px;">${esc(s)}</span>`).join('');

  const langList = () =>
    languages.map(l => `<div style="font-size:11.5px;color:#475569;margin-bottom:4px;">
      ${esc(l.language||l)} ${l.level ? `<span style="color:#94a3b8;">— ${esc(l.level)}</span>` : ''}
    </div>`).join('');

  const secHeader = (txt, color='#2563eb') =>
    `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:${color};border-bottom:2px solid ${color};padding-bottom:4px;margin:18px 0 10px;">${txt}</div>`;

  const secHeaderLine = (txt, color='#1e293b') =>
    `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:${color};border-left:3px solid ${color};padding-left:8px;margin:16px 0 10px;">${txt}</div>`;

  // ── Template: COM FOTO (Azul Profissional) ─────────────────────────────
  if (slug === 'com-foto') {
    const BLUE = '#1e3a6e', GOLD = '#c8960c', GRAY_BG = '#f8f9fa';
    const expB = experiences.map(e => `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-size:13px;font-weight:700;color:${BLUE};">${esc(e.company||e.title)}</div>
          <div style="font-size:10.5px;color:#888;margin-left:8px;">${esc(e.startDate||e.start||'')}${(e.endDate||e.end) ? ` – ${esc(e.endDate||e.end)}` : ' – Presente'}</div>
        </div>
        <div style="font-size:11.5px;color:#555;margin:1px 0 4px;">${esc(e.title)}</div>
        ${e.description ? `<div style="font-size:11.5px;color:#374151;line-height:1.65;">${nl2br(esc(e.description))}</div>` : ''}
      </div>`).join('');
    const eduB = education.map(e => `
      <div style="margin-bottom:10px;">
        <div style="font-size:12.5px;font-weight:700;color:${BLUE};">${esc(e.degree||e.course||'')}</div>
        <div style="font-size:11px;color:#555;">${esc(e.institution||'')}</div>
        <div style="font-size:10.5px;color:#888;">${esc(e.startDate||e.year||'')}</div>
      </div>`).join('');
    const secH = (txt) => `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${BLUE};border-bottom:1.5px solid ${GOLD};padding-bottom:3px;margin:14px 0 8px;">${txt}</div>`;
    const secR = (txt) => `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:${BLUE};border-bottom:2px solid ${GOLD};padding-bottom:4px;margin:18px 0 10px;">${txt}</div>`;
    const sideContacts = [
      phone    ? `📞 ${esc(phone)}`    : '',
      email    ? `✉ ${esc(email)}`     : '',
      address  ? `📍 ${esc(address)}`  : '',
      linkedin ? `in ${esc(linkedin)}` : '',
      website  ? `🌐 ${esc(website)}`  : ''
    ].filter(Boolean).map(c => `<div style="font-size:10.5px;color:#444;line-height:1.9;word-break:break-all;">${c}</div>`).join('');
    const sideSkills = skills.map(s => `<div style="font-size:10.5px;color:#444;line-height:1.8;">• ${esc(s)}</div>`).join('');
    const sideLangs  = languages.map(l => `<div style="font-size:10.5px;color:#444;line-height:1.8;">• ${esc(l.language||l)}${l.level ? ` (${esc(l.level)})` : ''}</div>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Poppins',Arial,sans-serif;background:#fff;font-size:12px;}</style>
    </head><body>
      <div style="padding:22px 32px 14px;display:flex;align-items:center;gap:18px;border-bottom:2.5px solid ${GOLD};">
        ${photoUrl ? `<img src="${photoUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2.5px solid ${GOLD};flex-shrink:0;">` : ''}
        <div>
          <div style="font-size:26px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:1px;">${esc(name)}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:2px;">${esc(jobTitle)}</div>
        </div>
      </div>
      <div style="display:flex;">
        <div style="width:32%;background:${GRAY_BG};padding:14px 16px;border-right:1px solid #e5e7eb;">
          ${secH('CONTACT')}${sideContacts}
          ${sideSkills ? secH('SKILLS')+sideSkills : ''}
          ${sideLangs  ? secH('LANGUAGES')+sideLangs : ''}
        </div>
        <div style="flex:1;padding:14px 24px;">
          ${summary ? secR('PROFILE')+`<p style="font-size:12px;line-height:1.7;color:#374151;">${esc(summary)}</p>` : ''}
          ${secR('WORK EXPERIENCE')}${expB}
          ${eduB ? secR('EDUCATION')+eduB : ''}
        </div>
      </div>
    </body></html>`;
  }

  // ── Template: SEM FOTO (Dourado Angolano) ──────────────────────────────
  if (slug === 'sem-foto') {
    const GOLD = '#c8960c', DARK = '#1a1a1a', SIDEBAR_BG = '#fffbf5';
    const expB = experiences.map(e => {
      const period = [e.startDate||e.start, e.endDate||e.end||'Actual'].filter(Boolean).join(' – ');
      return `<div style="display:flex;gap:0;margin-bottom:16px;">
        <div style="width:110px;flex-shrink:0;padding-right:12px;text-align:right;font-size:10.5px;color:#888;line-height:1.5;padding-top:2px;">${esc(period)}</div>
        <div style="flex:1;border-left:2px solid #f0e8d5;padding-left:14px;">
          <div style="font-size:12.5px;font-weight:700;color:${DARK};">${esc(e.company||e.title)}</div>
          <div style="font-size:11.5px;color:#555;margin:2px 0 4px;">${esc(e.title)}</div>
          ${e.description ? `<div style="margin-top:4px;"><div style="font-size:11.5px;font-weight:700;color:${DARK};margin-bottom:4px;">Responsabilidades:</div><div style="font-size:11.5px;color:#374151;line-height:1.65;">${nl2br(esc(e.description))}</div></div>` : ''}
        </div>
      </div>`;
    }).join('');
    const eduB = education.map(e => {
      const period = [e.startDate||e.start, e.endDate||e.end].filter(Boolean).join(' – ');
      return `<div style="margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;color:${DARK};">${esc(e.degree||e.course||'')}</div>
        <div style="font-size:11.5px;font-weight:600;color:${DARK};">${esc(e.institution||'')}</div>
        ${period ? `<div style="font-size:10.5px;color:#888;">${esc(period)}</div>` : ''}
      </div>`;
    }).join('');
    const sideSkills = skills.map(s => `<div style="font-size:11px;color:#374151;line-height:1.8;padding-left:8px;">• ${esc(s)}</div>`).join('');
    const sideLangs  = languages.map(l => `<div style="font-size:11px;color:#374151;line-height:1.8;padding-left:8px;">• ${esc(l.language||l)}${l.level ? ` (${esc(l.level)})` : ''}</div>`).join('');
    const contactRow = [
      phone    ? `<span><span style="color:${GOLD};">📞</span> ${esc(phone)}</span>`    : '',
      email    ? `<span><span style="color:${GOLD};">✉</span> ${esc(email)}</span>`     : '',
      address  ? `<span><span style="color:${GOLD};">📍</span> ${esc(address)}</span>`  : '',
      linkedin ? `<span><span style="color:${GOLD};">in</span> ${esc(linkedin)}</span>` : ''
    ].filter(Boolean).join('');
    const secS = (txt) => `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${GOLD};margin:14px 0 7px;">${txt}</div>`;
    const secM = (txt) => `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:${DARK};margin:18px 0 10px;padding-bottom:3px;border-bottom:1.5px solid #f0e8d5;">${txt}</div>`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Poppins',Arial,sans-serif;background:#fff;font-size:12px;}</style>
    </head><body>
      <div style="padding:20px 32px 12px;border-bottom:2px solid ${GOLD};">
        <div style="font-size:28px;font-weight:700;color:${DARK};text-transform:uppercase;text-align:center;letter-spacing:1px;">${esc(name)}</div>
        <div style="font-size:12.5px;color:#555;text-align:center;margin:4px 0 10px;letter-spacing:1px;">${esc(jobTitle)}</div>
        ${contactRow ? `<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:14px;font-size:11px;color:#555;padding:6px 0;">${contactRow}</div>` : ''}
      </div>
      <div style="display:flex;">
        <div style="width:35%;background:${SIDEBAR_BG};padding:10px 16px;border-right:1px solid #f0e8d5;">
          ${eduB ? secS('Educação')+eduB : ''}
          ${sideSkills ? secS('Habilidades Técnicas')+sideSkills : ''}
          ${sideLangs  ? secS('Competências Linguísticas')+sideLangs : ''}
        </div>
        <div style="flex:1;padding:10px 22px;">
          ${summary ? secM('Resumo Profissional')+`<p style="font-size:11.5px;line-height:1.75;color:#374151;">${esc(summary)}</p>` : ''}
          ${expB ? secM('Experiência de Trabalho')+expB : ''}
        </div>
      </div>
    </body></html>`;
  }

  // ── Template: ATS (ats-simples, ats-profissional, ats-executivo) ──────
  if (slug.includes('ats')) {
    const isExec = slug.includes('executivo');
    const isPro  = slug.includes('profissional');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>*{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff;padding:32px 36px;}</style>
    </head><body>
    ${isExec
      ? `<div style="border:1.5px solid #cbd5e1;padding:16px 20px;margin-bottom:16px;border-radius:3px;">
           <div style="font-size:22px;font-weight:800;color:#0f172a;">${esc(name)}</div>
           <div style="font-size:13px;color:#334155;margin:4px 0;">${esc(jobTitle)}</div>
           <div style="font-size:11px;color:#475569;margin-top:6px;">${contactLine}</div>
         </div>`
      : `<div style="margin-bottom:16px;${isPro ? 'border-bottom:1.5px solid #9ca3af;padding-bottom:12px;' : ''}">
           <div style="font-size:24px;font-weight:800;color:#0f172a;">${esc(name)}</div>
           <div style="font-size:13px;color:#374151;margin:4px 0;">${esc(jobTitle)}</div>
           <div style="font-size:11px;color:#6b7280;margin-top:6px;">${contactLine}</div>
         </div>`}
    ${summary ? `${secHeader('Resumo Profissional','#0f172a')}<p style="font-size:12px;color:#374151;line-height:1.7;">${nl2br(esc(summary))}</p>` : ''}
    ${experiences.length ? `${secHeader('Experiência Profissional','#0f172a')}${expBlocks('#0f172a','#6b7280','#0f172a')}` : ''}
    ${education.length   ? `${secHeader('Formação Académica','#0f172a')}${eduBlocks('#0f172a','#6b7280')}` : ''}
    ${skills.length      ? `${secHeader('Competências','#0f172a')}
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${skills.map(s=>`<span style="border:1px solid #cbd5e1;padding:3px 10px;border-radius:3px;font-size:11px;color:#1e293b;">${esc(s)}</span>`).join('')}
      </div>` : ''}
    ${languages.length   ? `${secHeader('Línguas','#0f172a')}${langList()}` : ''}
    </body></html>`;
  }

  // ── Template: cf-executivo-escuro (navy escuro + foto) ────────────────
  if (slug.includes('executivo-escuro')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="background:#0f172a;padding:32px 36px;display:flex;align-items:center;gap:24px;">
      ${photoUrl ? `<img src="${photoUrl}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #3b82f6;flex-shrink:0;">` : ''}
      <div>
        <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.3px;">${esc(name)}</div>
        <div style="font-size:14px;color:#93c5fd;margin:4px 0 10px;">${esc(jobTitle)}</div>
        <div style="font-size:11px;color:#94a3b8;">${contactLine}</div>
      </div>
    </div>
    <div style="padding:28px 36px;">
      ${summary ? `${secHeader('Sobre Mim','#1d4ed8')}<p style="font-size:12px;line-height:1.7;color:#334155;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#1d4ed8')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeader('Formação','#1d4ed8')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#1d4ed8')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#dbeafe','#1d4ed8')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#1d4ed8')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: cf-gradiente-roxo (purple gradient + foto centrada) ─────
  if (slug.includes('gradiente-roxo')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center;">
      ${photoUrl ? `<img src="${photoUrl}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);margin:0 auto 12px;display:block;">` : ''}
      <div style="font-size:26px;font-weight:800;color:#fff;">${esc(name)}</div>
      <div style="font-size:13px;color:#c4b5fd;margin:4px 0 10px;">${esc(jobTitle)}</div>
      <div style="font-size:11px;color:rgba(255,255,255,.7);">${contactLine}</div>
    </div>
    <div style="padding:28px 36px;">
      ${summary ? `${secHeader('Resumo','#4f46e5')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#4f46e5')}${expBlocks('#1e293b','#6b7280','#4f46e5')}` : ''}
      ${education.length   ? `${secHeader('Formação','#4f46e5')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#4f46e5')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#ede9fe','#4f46e5')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#4f46e5')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: cf-verde-profissional (verde + foto) ────────────────────
  if (slug.includes('verde-profissional')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="background:#15803d;padding:30px 36px;display:flex;align-items:center;gap:22px;">
      ${photoUrl ? `<img src="${photoUrl}" style="width:85px;height:85px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);flex-shrink:0;">` : ''}
      <div>
        <div style="font-size:25px;font-weight:800;color:#fff;">${esc(name)}</div>
        <div style="font-size:13px;color:#bbf7d0;margin:4px 0 8px;">${esc(jobTitle)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.75);">${contactLine}</div>
      </div>
    </div>
    <div style="padding:28px 36px;">
      ${summary ? `${secHeader('Resumo','#15803d')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#15803d')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeader('Formação','#15803d')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#15803d')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#dcfce7','#15803d')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#15803d')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: cf-teal-moderno (teal sidebar + foto) ───────────────────
  if (slug.includes('teal-moderno')) {
    const sideSkills = skills.map(s => `<div style="font-size:11px;color:rgba(255,255,255,.85);margin-bottom:5px;">• ${esc(s)}</div>`).join('');
    const sideLang   = languages.map(l => `<div style="font-size:11px;color:rgba(255,255,255,.85);margin-bottom:5px;">${esc(l.language||l)}${l.level?` (${esc(l.level)})`:''}</div>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;display:flex;min-height:100vh;}</style>
    </head><body>
    <div style="width:220px;background:#0d9488;padding:28px 20px;flex-shrink:0;">
      ${photoUrl ? `<img src="${photoUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.3);display:block;margin:0 auto 16px;">` : ''}
      <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:4px;text-align:center;">${esc(name)}</div>
      <div style="font-size:11px;color:#99f6e4;text-align:center;margin-bottom:18px;">${esc(jobTitle)}</div>
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,.6);letter-spacing:1px;margin-bottom:6px;">Contacto</div>
      ${contacts.map(c=>`<div style="font-size:10.5px;color:rgba(255,255,255,.8);margin-bottom:5px;">${esc(c)}</div>`).join('')}
      ${skills.length ? `<div style="font-size:9px;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,.6);letter-spacing:1px;margin:14px 0 6px;">Competências</div>${sideSkills}` : ''}
      ${languages.length ? `<div style="font-size:9px;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,.6);letter-spacing:1px;margin:14px 0 6px;">Línguas</div>${sideLang}` : ''}
    </div>
    <div style="flex:1;padding:28px 28px;">
      ${summary ? `${secHeaderLine('Resumo','#0d9488')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeaderLine('Experiência','#0d9488')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeaderLine('Formação','#0d9488')}${eduBlocks()}` : ''}
    </div></body></html>`;
  }

  // ── Template: cf-coral-criativo (coral/rose centrado + foto) ─────────
  if (slug.includes('coral-criativo')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="background:#be185d;padding:28px 36px;display:flex;align-items:center;gap:22px;">
      ${photoUrl ? `<img src="${photoUrl}" style="width:85px;height:85px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.35);flex-shrink:0;">` : ''}
      <div>
        <div style="font-size:25px;font-weight:800;color:#fff;">${esc(name)}</div>
        <div style="font-size:13px;color:#fbcfe8;margin:4px 0 8px;">${esc(jobTitle)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);">${contactLine}</div>
      </div>
    </div>
    <div style="padding:28px 36px;">
      ${summary ? `${secHeader('Resumo','#be185d')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#be185d')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeader('Formação','#be185d')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#be185d')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#fce7f3','#be185d')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#be185d')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: sf-corporate-azul (barra azul topo, 2 colunas) ─────────
  if (slug.includes('corporate-azul')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="background:#1d4ed8;height:8px;"></div>
    <div style="padding:28px 36px 16px;">
      <div style="font-size:26px;font-weight:800;color:#0f172a;">${esc(name)}</div>
      <div style="font-size:13px;color:#1d4ed8;font-weight:600;margin:4px 0 8px;">${esc(jobTitle)}</div>
      <div style="font-size:11px;color:#64748b;">${contactLine}</div>
    </div>
    <div style="height:1px;background:#e2e8f0;margin:0 36px;"></div>
    <div style="padding:16px 36px;">
      ${summary ? `${secHeader('Resumo Profissional','#1d4ed8')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#1d4ed8')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeader('Formação','#1d4ed8')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#1d4ed8')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#dbeafe','#1d4ed8')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#1d4ed8')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: sf-cinza-tecnico (sidebar cinza clara) ─────────────────
  if (slug.includes('cinza-tecnico')) {
    const sideContent = `
      <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:6px;">Contacto</div>
      ${contacts.map(c=>`<div style="font-size:10.5px;color:#374151;margin-bottom:5px;">${esc(c)}</div>`).join('')}
      ${skills.length ? `<div style="font-size:9.5px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin:14px 0 6px;">Competências</div>
        ${skills.map(s=>`<div style="font-size:11px;color:#374151;margin-bottom:4px;">▪ ${esc(s)}</div>`).join('')}` : ''}
      ${languages.length ? `<div style="font-size:9.5px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin:14px 0 6px;">Línguas</div>${langList()}` : ''}
    `;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;display:flex;min-height:100vh;}</style>
    </head><body>
    <div style="width:210px;background:#f1f5f9;padding:28px 18px;flex-shrink:0;border-right:1px solid #e2e8f0;">
      <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;">${esc(name)}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:18px;">${esc(jobTitle)}</div>
      ${sideContent}
    </div>
    <div style="flex:1;padding:28px 28px;">
      ${summary ? `${secHeaderLine('Resumo','#334155')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeaderLine('Experiência','#334155')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeaderLine('Formação','#334155')}${eduBlocks()}` : ''}
    </div></body></html>`;
  }

  // ── Template: sf-verde-academico (cabeçalho verde centrado) ──────────
  if (slug.includes('verde-academico')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Georgia',serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="text-align:center;padding:28px 36px 16px;border-bottom:2px solid #15803d;">
      <div style="font-size:24px;font-weight:700;color:#0f172a;letter-spacing:.3px;">${esc(name)}</div>
      <div style="font-size:13px;color:#15803d;margin:5px 0 8px;">${esc(jobTitle)}</div>
      <div style="font-size:11px;color:#64748b;">${contactLine}</div>
    </div>
    <div style="padding:20px 48px;">
      ${summary ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#15803d;margin:16px 0 8px;">Resumo</div><p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#15803d;margin:18px 0 8px;">Experiência</div>${expBlocks('#0f172a','#64748b')}` : ''}
      ${education.length   ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#15803d;margin:18px 0 8px;">Formação</div>${eduBlocks()}` : ''}
      ${skills.length      ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#15803d;margin:18px 0 8px;">Competências</div><div style="display:flex;flex-wrap:wrap;">${skillTags('#dcfce7','#15803d')}</div>` : ''}
      ${languages.length   ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#15803d;margin:18px 0 8px;">Línguas</div>${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: sf-laranja-criativo (faixa laranja esquerda) ───────────
  if (slug.includes('laranja-criativo')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;display:flex;min-height:100vh;}</style>
    </head><body>
    <div style="width:6px;background:linear-gradient(180deg,#ea580c,#f97316);flex-shrink:0;"></div>
    <div style="flex:1;padding:32px 36px;">
      <div style="margin-bottom:20px;">
        <div style="font-size:26px;font-weight:800;color:#0f172a;">${esc(name)}</div>
        <div style="font-size:13px;color:#ea580c;font-weight:600;margin:4px 0 8px;">${esc(jobTitle)}</div>
        <div style="font-size:11px;color:#64748b;">${contactLine}</div>
      </div>
      ${summary ? `${secHeader('Resumo','#ea580c')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#ea580c')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeader('Formação','#ea580c')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#ea580c')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#ffedd5','#ea580c')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#ea580c')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: sf-navy-executivo (navy centrado, sem foto) ─────────────
  if (slug.includes('navy-executivo')) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
    </head><body>
    <div style="background:#0f172a;padding:28px 36px;text-align:center;">
      <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:.5px;">${esc(name)}</div>
      <div style="font-size:13px;color:#93c5fd;margin:5px 0 10px;">${esc(jobTitle)}</div>
      <div style="font-size:11px;color:#94a3b8;">${contactLine}</div>
    </div>
    <div style="padding:24px 36px;">
      ${summary ? `${secHeader('Resumo','#1d4ed8')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
      ${experiences.length ? `${secHeader('Experiência','#1d4ed8')}${expBlocks()}` : ''}
      ${education.length   ? `${secHeader('Formação','#1d4ed8')}${eduBlocks()}` : ''}
      ${skills.length      ? `${secHeader('Competências','#1d4ed8')}<div style="display:flex;flex-wrap:wrap;">${skillTags('#dbeafe','#1d4ed8')}</div>` : ''}
      ${languages.length   ? `${secHeader('Línguas','#1d4ed8')}${langList()}` : ''}
    </div></body></html>`;
  }

  // ── Template: sf-minimalista-clean / cf-classico-azul (default) ──────
  // Também serve como fallback para qualquer slug não reconhecido
  const accentColor = slug.includes('minimalista') ? '#2563eb' : '#2563eb';
  const hasPhoto = photoUrl && (slug.includes('cf-') || slug.includes('classico') || slug.includes('com_foto'));
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;font-size:12px;color:#1e293b;background:#fff;}</style>
  </head><body>
  <div style="border-top:5px solid ${accentColor};padding:28px 36px 16px;">
    <div style="display:flex;align-items:center;gap:20px;">
      ${hasPhoto ? `<img src="${photoUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : ''}
      <div>
        <div style="font-size:24px;font-weight:800;color:#0f172a;">${esc(name)}</div>
        <div style="font-size:13px;color:${accentColor};font-weight:600;margin:4px 0 8px;">${esc(jobTitle)}</div>
        <div style="font-size:11px;color:#64748b;">${contactLine}</div>
      </div>
    </div>
  </div>
  <div style="padding:8px 36px 28px;">
    ${summary ? `${secHeader('Resumo','#2563eb')}<p style="font-size:12px;line-height:1.7;color:#374151;">${nl2br(esc(summary))}</p>` : ''}
    ${experiences.length ? `${secHeader('Experiência','#2563eb')}${expBlocks()}` : ''}
    ${education.length   ? `${secHeader('Formação','#2563eb')}${eduBlocks()}` : ''}
    ${skills.length      ? `${secHeader('Competências','#2563eb')}<div style="display:flex;flex-wrap:wrap;">${skillTags()}</div>` : ''}
    ${languages.length   ? `${secHeader('Línguas','#2563eb')}${langList()}` : ''}
  </div></body></html>`;
}

function generateSummaryLocal(name, jobTitle, experiences, skills, yearsExp) {
  const j = (jobTitle || '').trim();
  const jl = j.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const yrs = yearsExp ? yearsExp : '';
  const expRaw = experiences ? String(experiences) : '';
  const exp = expRaw.slice(0, 120);
  // texto combinado para matching: título + experiências (permite inferir área quando título é ambíguo)
  const combined = (jl + ' ' + expRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')).slice(0, 600);
  const sk  = skills     ? String(skills).slice(0, 80)       : '';
  const yrsLabel = yrs ? `com ${yrs} de experiência` : 'com experiência na área';
  const skNote   = sk ? ` Domínio em ${sk}.` : '';

  // Helper que monta o resumo a partir de fragmentos específicos da profissão
  const build = (intro, body, close) =>
    `${intro} ${yrsLabel}. ${body}${skNote} ${close}`;

  // ── Manutenção / Técnico de Instalações ───────────────────
  // Detectado pelo título OU pelas experiências (ex: "Técnico de RH" com exp de manutenção)
  if (/manutenc|tecnic.*manut|tecnic.*instala|tecnic.*equip|tecnic.*repara|eletricist|hidraul|mecanic.*tecnic|tecnic.*mecanic|tecnic.*electr|tecnic.*hvac|tecnic.*refriger|frigori/i.test(combined) ||
      /avaria|peca.*sobressel|sobresselente|ficha.*manutenc|preventiv.*correct|correctiv.*prevent/i.test(combined))
    return build(
      `Técnico(a) de Manutenção especializado(a) em manutenção preventiva e correctiva de equipamentos e instalações`,
      `Experiência no diagnóstico de falhas e avarias, execução de reparações mecânicas, eléctricas e hidráulicas, e registo de intervenções técnicas. Controlo rigoroso do stock de peças sobresselentes e consumíveis, garantindo a operacionalidade contínua dos equipamentos.${exp ? ` Contexto: ${exp}.` : ''}`,
      `Orientado(a) para a eficiência operacional, segurança no trabalho e melhoria contínua do plano de manutenção.`
    );

  // ── Cozinha / Restauração ──────────────────────────────────
  if (/cozinheir|chef|pasteleiro|padeiro|confeit|restaura|caterl/i.test(jl))
    return build(
      `Chef de Cozinha especializado(a) na confecção de pratos da culinária tradicional e internacional`,
      `Experiência na gestão de cozinha, controlo de stocks, elaboração de ementas e garantia dos padrões HACCP. Capacidade de coordenar brigadas de cozinha em ambientes de alta rotatividade, mantendo a qualidade e apresentação dos pratos.${exp ? ` Histórico profissional inclui: ${exp}.` : ''}`,
      `Focado(a) na excelência gastronómica e na satisfação do cliente.`
    );

  // ── Motorista / Condutor ──────────────────────────────────
  if (/motorista|condutor|chofer|transportador|logistic.*motor/i.test(jl))
    return build(
      `Motorista profissional`,
      `Historial comprovado no transporte seguro de passageiros e mercadorias, com respeito rigoroso pelo código da estrada e prazos de entrega. Experiência em rotas urbanas e inter-provinciais, bem como na manutenção preventiva de veículos.${exp ? ` Empresas onde trabalhou: ${exp}.` : ''}`,
      `Comprometido(a) com a segurança, pontualidade e boa conduta no exercício da função.`
    );

  // ── Segurança / Vigilante ─────────────────────────────────
  if (/seguran|vigilante|guarda|protec/i.test(jl))
    return build(
      `Agente de Segurança`,
      `Experiência em controlo de acessos, vigilância de instalações e gestão de ocorrências. Capacidade de actuar com calma sob pressão, comunicar eficazmente e garantir a segurança de pessoas e bens. Conhecimento de primeiros socorros e protocolos de emergência.${exp ? ` Locais de serviço: ${exp}.` : ''}`,
      `Rigoroso(a), discreto(a) e comprometido(a) com a protecção das instalações e colaboradores.`
    );

  // ── Vendas / Comercial ────────────────────────────────────
  if (/vend|comercial|representante.*vend|agente.*vend|sales|account manager/i.test(jl))
    return build(
      `Profissional Comercial`,
      `Experiência comprovada em prospeção de clientes, negociação e fecho de vendas. Orientado(a) para resultados, com capacidade de superar metas e construir relações de longo prazo com clientes. Conhecimento do mercado angolano e das suas especificidades.${exp ? ` Experiências anteriores: ${exp}.` : ''}`,
      `Motivado(a) pelo crescimento das carteiras de clientes e pelo cumprimento de objectivos comerciais.`
    );

  // ── RH / Recursos Humanos ─────────────────────────────────
  if (/recursos.hum|gestao.*rh|\brh\b|hr\b|recrutamento|talent|people/i.test(jl))
    return build(
      `Técnico(a) de Recursos Humanos`,
      `Sólida experiência em recrutamento e selecção, processamento salarial, gestão de benefícios e conformidade laboral angolana (INSS, IRT, RENT). Capacidade de desenvolver políticas internas, planos de carreira e acções de formação.${exp ? ` Histórico: ${exp}.` : ''}`,
      `Comprometido(a) com uma gestão de pessoas justa, ética e orientada para o desenvolvimento organizacional.`
    );

  // ── Contabilidade / Finanças ──────────────────────────────
  if (/contabil|contabilist|financ|fiscal|audit|tesourar|economist/i.test(jl))
    return build(
      `Profissional de Contabilidade e Finanças`,
      `Experiência em elaboração de demonstrações financeiras, conciliação bancária, apuramento de impostos e reporte para a AGT. Rigor no cumprimento das obrigações fiscais e conhecimento da legislação tributária angolana.${exp ? ` Empresas: ${exp}.` : ''}`,
      `Comprometido(a) com a exactidão, transparência e integridade na gestão financeira.`
    );

  // ── Engenharia / Técnico ──────────────────────────────────
  if (/engenh|electricist|canalizador|mecanic|industrial/i.test(jl))
    return build(
      `Profissional de Engenharia e Manutenção`,
      `Experiência em manutenção preventiva e correctiva de equipamentos, leitura de plantas técnicas e resolução de avarias. Capacidade de trabalhar sob pressão e cumprir prazos em ambientes industriais e de construção.${exp ? ` Projectos e empresas: ${exp}.` : ''}`,
      `Orientado(a) para a eficiência operacional, segurança no trabalho e melhoria contínua dos processos.`
    );

  // ── Professor / Formador ──────────────────────────────────
  if (/professor|docente|formador|educador|pedagogia|ensino/i.test(jl))
    return build(
      `Profissional de Educação e Formação`,
      `Experiência no planeamento e leccionação de aulas, desenvolvimento de materiais didácticos e avaliação de alunos. Capacidade de adaptar o ensino a diferentes perfis e necessidades, promovendo um ambiente de aprendizagem motivador.${exp ? ` Instituições: ${exp}.` : ''}`,
      `Apaixonado(a) pelo desenvolvimento das capacidades dos alunos e pela qualidade do ensino em Angola.`
    );

  // ── Saúde / Enfermagem / Medicina ─────────────────────────
  if (/enfermeiro|enfermagem|medico|medica|farmaceut|clinic|saude|laborator/i.test(jl))
    return build(
      `Profissional de Saúde`,
      `Experiência no cuidado e acompanhamento de doentes, administração de medicação e registo clínico. Actuação com rigor técnico, sigilo profissional e sensibilidade humana no atendimento ao paciente.${exp ? ` Unidades de saúde: ${exp}.` : ''}`,
      `Comprometido(a) com o bem-estar dos doentes e com a qualidade dos serviços de saúde prestados.`
    );

  // ── Informática / Programação / TI ───────────────────────
  if (/programador|developer|informatica|software|sistemas|ti |it |tecnologia|web|dados|data/i.test(jl))
    return build(
      `Profissional de Tecnologia e Sistemas de Informação`,
      `Experiência no desenvolvimento, implementação e suporte de soluções tecnológicas. Capacidade de analisar requisitos, resolver problemas técnicos e colaborar em equipas multidisciplinares de TI.${exp ? ` Projectos: ${exp}.` : ''}`,
      `Focado(a) na entrega de soluções digitais eficientes e na adopção das melhores práticas do sector.`
    );

  // ── Marketing / Comunicação ───────────────────────────────
  if (/marketing|publicidade|comunicacao|community|social media|digital|branding/i.test(jl))
    return build(
      `Profissional de Marketing e Comunicação`,
      `Experiência na criação de campanhas, gestão de redes sociais, produção de conteúdo e análise de métricas digitais. Capacidade criativa aliada a um pensamento estratégico orientado para resultados mensuráveis.${exp ? ` Marcas e projectos: ${exp}.` : ''}`,
      `Apaixonado(a) por construir marcas relevantes e criar ligações autênticas entre as empresas e o seu público.`
    );

  // ── Bancário ──────────────────────────────────────────────
  if (/bancario|banco|credito|gestor.*conta|compliance|risco.*financ/i.test(jl))
    return build(
      `Profissional Bancário`,
      `Experiência no atendimento a clientes empresariais e particulares, análise de crédito e gestão de carteiras. Conhecimento da regulamentação do sector financeiro angolano e das exigências do BNA.${exp ? ` Bancos e entidades: ${exp}.` : ''}`,
      `Orientado(a) para a fidelização de clientes, controlo de risco e crescimento sustentável do negócio.`
    );

  // ── Recepcionista / Secretária / Administrativo ───────────
  if (/recepcion|secretar|administrat|assistente.*admin|office/i.test(jl))
    return build(
      `Profissional Administrativo(a)`,
      `Experiência em gestão de agenda, atendimento presencial e telefónico, organização de documentação e apoio à direcção. Rigoroso(a), proactivo(a) e com forte sentido de confidencialidade.${exp ? ` Empresas: ${exp}.` : ''}`,
      `Comprometido(a) com a eficiência administrativa e com a boa imagem institucional da organização.`
    );

  // ── Logística / Armazém ───────────────────────────────────
  if (/logistic|armazem|warehouse|stock|inventario|compras|aprovisionamento/i.test(jl))
    return build(
      `Profissional de Logística e Gestão de Stocks`,
      `Experiência na gestão de armazém, controlo de inventários, coordenação de entregas e optimização da cadeia de abastecimento. Capacidade de reduzir custos operacionais mantendo os níveis de serviço.${exp ? ` Empresas: ${exp}.` : ''}`,
      `Focado(a) na eficiência da cadeia logística e no cumprimento rigoroso dos prazos de entrega.`
    );

  // ── Gestor / Director / Líder ─────────────────────────────
  if (/gestor|director|lider|manager|coordenador|supervisor|chefe.*depart/i.test(jl))
    return build(
      `Gestor(a) com sólida capacidade de liderança`,
      `Experiência na definição de estratégias, gestão de equipas e acompanhamento de KPIs. Historial de alcance de resultados em ambientes de alta exigência, com foco no desenvolvimento das pessoas e na eficiência dos processos.${exp ? ` Organizações: ${exp}.` : ''}`,
      `Comprometido(a) com o crescimento sustentável da organização e com a valorização do capital humano.`
    );

  // ── Limpeza / Higiene ─────────────────────────────────────
  if (/limpeza|higiene|lavandaria|housekeeping|auxiliar.*limpeza/i.test(jl))
    return build(
      `Auxiliar de Limpeza e Higienização`,
      `Experiência na limpeza e manutenção de instalações comerciais, hoteleiras e industriais, com conhecimento de produtos de higienização e técnicas adequadas a cada superfície. Pontual, responsável e com espírito de equipa.${exp ? ` Locais de trabalho: ${exp}.` : ''}`,
      `Comprometido(a) com a higiene, organização e o bom ambiente das instalações.`
    );

  // ── DEFAULT — genérico mas estruturado por cargo ──────────
  const intro = j ? `${j}` : 'Profissional';
  return `${intro} ${yrsLabel}. ${exp ? `Experiência profissional inclui: ${exp}. ` : ''}Actua com rigor técnico, sentido de responsabilidade e foco em resultados concretos. Adaptável a diferentes contextos organizacionais, com capacidade de trabalho autónomo e em equipa.${skNote} Comprometido(a) com o desenvolvimento profissional contínuo e com a criação de valor para a organização.`;
}

function generateResponsibilitiesLocal(jobTitle) {
  const jt = (jobTitle || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const maps = [
    // Cozinha / Restauração
    { rx: /cozinheir|chef|pasteleiro|padeiro|confeit/,
      items: [
        'Preparar e confeccionar refeições diárias (pequeno-almoço, almoço e jantar)',
        'Elaborar pratos de acordo com o menu definido ou orientação superior',
        'Garantir a higiene e segurança alimentar em todo o processo de confecção',
        'Controlar a conservação dos alimentos, respeitando validades e condições de armazenamento',
        'Organizar e manter a cozinha limpa e em condições de trabalho',
        'Gerir stocks básicos de ingredientes e comunicar necessidades de reposição',
        'Adaptar refeições a necessidades específicas (dietas, alergias, crianças)',
        'Coordenar os tempos de preparo para cumprir os horários das refeições',
      ]},
    // Motorista / Condutor
    { rx: /motorista|condutor|driver|chofer/,
      items: [
        'Conduzir veículos de forma segura, respeitando o código da estrada e os regulamentos internos',
        'Transportar passageiros ou mercadorias para os destinos definidos no roteiro diário',
        'Verificar o estado do veículo antes de cada saída (nível de óleo, pneus, travões, luzes)',
        'Reportar avarias e agendar intervenções de manutenção preventiva',
        'Gerir o registo de quilómetros percorridos, combustível consumido e ocorrências de viagem',
        'Garantir a segurança e o conforto dos passageiros ou a integridade da carga transportada',
        'Conhecer rotas alternativas para minimizar atrasos e optimizar os percursos',
      ]},
    // Segurança / Vigilância
    { rx: /seguranca|vigilant|guarda|porteiro/,
      items: [
        'Controlar o acesso de pessoas e viaturas às instalações, verificando credenciais',
        'Efectuar rondas periódicas às instalações para detectar situações irregulares',
        'Monitorizar o sistema de videovigilância (CCTV) e registar ocorrências',
        'Actuar em situações de emergência (incêndio, intrusão, acidente) seguindo os procedimentos',
        'Gerir o livro de ocorrências e elaborar relatórios de turno',
        'Garantir a protecção de pessoas, bens e equipamentos das instalações',
        'Comunicar de imediato situações suspeitas ao superior hierárquico ou às autoridades',
      ]},
    // Limpeza / Higienização
    { rx: /limpeza|higieniz|copeiro|faxineir/,
      items: [
        'Limpar e higienizar escritórios, instalações sanitárias, corredores e áreas comuns',
        'Varrer, aspirar, encerar e lavar os pavimentos conforme o plano de limpeza',
        'Limpar vidros, janelas e superfícies horizontais com os produtos adequados',
        'Recolher e separar o lixo, colocando-o nos contentores correctos',
        'Repor consumíveis nas casas de banho (papel, sabão, toalhas)',
        'Gerir o stock de produtos de limpeza e comunicar necessidades de reposição',
        'Cumprir as normas de higiene, segurança e utilização correcta dos produtos químicos',
      ]},
    // Contabilidade / Finanças
    { rx: /contabilist|financ|auditor|fiscal|tesourar/,
      items: [
        'Lançar e classificar documentos contabilísticos (facturas, recibos, notas de crédito)',
        'Elaborar balancetes, demonstrações de resultados e balanços mensais',
        'Reconciliar contas bancárias e gerir extractos de movimentos',
        'Preparar e submeter declarações fiscais (IRT, IVA, IRC) nos prazos legais',
        'Controlar contas a pagar e a receber, acompanhando cobranças e pagamentos',
        'Analisar desvios orçamentais e apresentar relatórios à gestão',
        'Arquivar e organizar toda a documentação financeira e fiscal',
      ]},
    // Vendas / Comercial
    { rx: /vendedor|comercial|sales|agente comercial|representante/,
      items: [
        'Prospetar e captar novos clientes através de visitas, chamadas e referências',
        'Apresentar e demonstrar produtos ou serviços de acordo com as necessidades do cliente',
        'Negociar preços, condições e prazos de entrega, garantindo margens definidas',
        'Acompanhar e fidelizar a carteira de clientes existentes com visitas regulares',
        'Registar todas as actividades e oportunidades de negócio no CRM',
        'Elaborar propostas comerciais e acompanhar o processo de fecho de vendas',
        'Cumprir e superar as metas comerciais mensais estabelecidas pela direcção',
      ]},
    // Electricista
    { rx: /electricista|eletricista|electric/,
      items: [
        'Instalar sistemas eléctricos em edifícios residenciais, comerciais e industriais',
        'Realizar a manutenção preventiva e correctiva de instalações eléctricas',
        'Diagnosticar avarias eléctricas e proceder à sua reparação com segurança',
        'Ler e interpretar esquemas, plantas e projectos eléctricos',
        'Instalar e ligar quadros eléctricos, disjuntores, tomadas e cablagens',
        'Cumprir rigorosamente as normas de segurança eléctrica (NP, IEC)',
        'Registar as intervenções realizadas e elaborar relatórios técnicos',
      ]},
    // Canalizador / Técnico de manutenção
    { rx: /canalizador|explicador|mecanic|manutenc|tecnico/,
      items: [
        'Realizar a manutenção preventiva e correctiva de equipamentos e instalações',
        'Diagnosticar falhas e avarias, identificando a causa raiz do problema',
        'Executar reparações mecânicas, eléctricas ou hidráulicas conforme necessário',
        'Registar todas as intervenções técnicas em fichas de manutenção',
        'Controlar o stock de peças sobresselentes e consumíveis',
        'Assegurar que os equipamentos operam dentro dos parâmetros de segurança',
        'Propor melhorias e optimizações no plano de manutenção preventiva',
      ]},
    // Professor / Docente
    { rx: /professor|docente|educador|formador|instrutor/,
      items: [
        'Planificar e leccionar aulas de acordo com o currículo e programa definido',
        'Preparar materiais didácticos, fichas de trabalho e testes de avaliação',
        'Avaliar os alunos de forma contínua e sumativa, registando o progresso individual',
        'Acompanhar alunos com dificuldades e adaptar estratégias de ensino',
        'Participar em reuniões de conselho de turma e reuniões pedagógicas',
        'Comunicar regularmente com os encarregados de educação sobre o desempenho dos alunos',
        'Manter registos de assiduidade, notas e ocorrências disciplinares actualizados',
      ]},
    // Recursos Humanos
    { rx: /recursos humanos|rh\b|recrutamento|gestao de pessoas/,
      items: [
        'Publicar vagas, triagem de candidaturas e gestão do processo de recrutamento',
        'Realizar entrevistas de selecção e aplicar testes de avaliação de competências',
        'Elaborar contratos de trabalho, adendas e processar admissões e cessações',
        'Controlar assiduidade, gerir mapas de férias e ausências',
        'Processar salários, subsídios e encargos sociais (INSS, IRT)',
        'Organizar acções de formação interna e gerir o plano de desenvolvimento de competências',
        'Garantir o cumprimento da legislação laboral angolana e gerir processos disciplinares',
      ]},
    // Marketing / Comunicação
    { rx: /marketing|social media|comunicacao|publicidade|community/,
      items: [
        'Gerir as redes sociais da empresa (Instagram, Facebook, LinkedIn, TikTok)',
        'Criar e publicar conteúdos (textos, imagens, vídeos) alinhados com a identidade da marca',
        'Planear e executar campanhas de publicidade digital (Meta Ads, Google Ads)',
        'Analisar métricas de desempenho e elaborar relatórios mensais com conclusões e acções',
        'Gerir o website, actualizar conteúdos e optimizar para SEO',
        'Coordenar acções de marketing com designers, fotógrafos e parceiros externos',
        'Desenvolver estratégias de crescimento orgânico e aumento do engagement',
      ]},
    // Engenheiro (genérico)
    { rx: /engenheir|engenheiro/,
      items: [
        'Desenvolver e supervisionar projectos técnicos desde a concepção até à conclusão',
        'Elaborar memórias descritivas, especificações técnicas e peças desenhadas',
        'Fiscalizar obras e instalações, garantindo conformidade com os projectos aprovados',
        'Controlar a qualidade dos materiais e dos trabalhos executados em obra',
        'Coordenar equipas técnicas e subempreiteiros no terreno',
        'Identificar e resolver problemas técnicos de forma ágil e fundamentada',
        'Elaborar relatórios de progresso, vistorias e autos de medição',
      ]},
    // Programador / Desenvolvedor
    { rx: /programador|developer|desenvolvedor|software|informatica|it\b|tecnologia/,
      items: [
        'Desenvolver aplicações web e/ou mobile com base nos requisitos do projecto',
        'Escrever código limpo, testável e bem documentado seguindo as boas práticas',
        'Participar em revisões de código (code review) e sessões de pair programming',
        'Diagnosticar e corrigir bugs reportados em produção e ambientes de testes',
        'Integrar APIs externas e serviços de terceiros nas soluções desenvolvidas',
        'Colaborar com designers UX/UI para garantir interfaces funcionais e intuitivas',
        'Manter e optimizar sistemas existentes, reduzindo tempos de resposta e consumo de recursos',
      ]},
    // Médico / Enfermeiro / Saúde
    { rx: /medico|enfermeiro|enfermeira|farmaceut|saude|clinico|cirurgiao/,
      items: [
        'Realizar consultas médicas, colher historial clínico e examinar os pacientes',
        'Diagnosticar doenças e prescrever tratamentos, medicamentos e exames complementares',
        'Acompanhar o estado clínico dos pacientes internados e ajustar terapêuticas',
        'Executar procedimentos clínicos e cirúrgicos dentro do âmbito de especialidade',
        'Registar e actualizar os processos clínicos de cada paciente',
        'Encaminhar casos para especialistas e articular com equipas multidisciplinares',
        'Promover acções de educação para a saúde junto de pacientes e familiares',
      ]},
    // Recepcionista / Secretária
    { rx: /recepcionista|secretaria|secretario|assistente admin|assistente execut/,
      items: [
        'Receber e encaminhar visitantes, clientes e parceiros de forma profissional',
        'Atender e filtrar chamadas telefónicas, tomando mensagens e encaminhando para os responsáveis',
        'Gerir a agenda do director ou da equipa, marcando reuniões e compromissos',
        'Redigir e enviar correspondência, e-mails e documentos oficiais',
        'Organizar e arquivar documentação física e digital com rigor e confidencialidade',
        'Tratar de tarefas administrativas (compras de escritório, gestão de correio, apoio logístico)',
        'Coordenar salas de reunião e apoiar na organização de eventos internos',
      ]},
    // Gestor / Director / Coordenador
    { rx: /gestor|director|gerente|coordenador|responsavel|manager|lider/,
      items: [
        'Definir objectivos estratégicos e operacionais para a equipa ou departamento',
        'Gerir, motivar e desenvolver uma equipa de colaboradores',
        'Planear e controlar o orçamento anual do departamento',
        'Monitorizar indicadores de desempenho (KPIs) e tomar acções correctivas',
        'Reportar regularmente à administração o estado das operações e resultados',
        'Negociar com fornecedores, parceiros e clientes estratégicos',
        'Implementar processos de melhoria contínua e optimização operacional',
      ]},
    // Armazém / Logística / Operador
    { rx: /armazem|logistic|stock|inventar|operador|estivador|pick|warehouse/,
      items: [
        'Receber, conferir e armazenar mercadorias de acordo com os procedimentos internos',
        'Preparar encomendas (picking e packing) com precisão e dentro dos prazos',
        'Controlar o stock físico e reconciliar com o sistema de gestão (ERP/WMS)',
        'Organizar o armazém optimizando o espaço e facilitando o acesso às referências',
        'Operar equipamentos de movimentação de cargas (empilhador, porta-paletes)',
        'Registar entradas e saídas de stock e reportar divergências',
        'Garantir a correcta etiquetagem, lote e rastreabilidade dos produtos',
      ]},
    // Construção Civil / Pedreiro / Obras
    { rx: /pedreiro|construcao|civil|obras|pintor|carpinteir|soldador/,
      items: [
        'Executar trabalhos de construção, remodelação e acabamentos conforme projecto',
        'Ler e interpretar plantas e desenhos técnicos de construção civil',
        'Preparar e aplicar materiais de construção (betão, argamassa, revestimentos)',
        'Garantir o cumprimento das normas de segurança em obra (EPI, sinalização)',
        'Coordenar o trabalho com outros oficiais e subempreiteiros no estaleiro',
        'Controlar a qualidade dos materiais e técnicas aplicadas',
        'Reportar ao encarregado o progresso diário e eventuais problemas de obra',
      ]},
    // Advogado / Jurídico
    { rx: /advogado|juridic|direito|jurist|legal/,
      items: [
        'Prestar aconselhamento jurídico a clientes em matérias de direito civil, comercial ou laboral',
        'Redigir contratos, pareceres, petições, recursos e outros instrumentos jurídicos',
        'Representar clientes em tribunal e em processos administrativos e arbitrais',
        'Analisar a legalidade de operações empresariais e identificar riscos jurídicos',
        'Acompanhar a evolução legislativa e regulatória relevante para os clientes',
        'Negociar acordos e resolver litígios de forma extrajudicial quando possível',
        'Gerir prazos processuais e manter os processos actualizados no sistema interno',
      ]},
    // Assistente Social / Psicólogo
    { rx: /assistente social|psicolog|conselheir|social worker/,
      items: [
        'Realizar entrevistas de avaliação social ou psicológica para diagnóstico de situações',
        'Elaborar planos de intervenção individualizados e acompanhar a sua execução',
        'Articular com entidades externas (hospitais, tribunais, instituições) para apoio integrado',
        'Prestar apoio emocional e aconselhamento a indivíduos e famílias em situação de vulnerabilidade',
        'Elaborar relatórios técnicos e participar em reuniões de equipa multidisciplinar',
        'Promover acções de sensibilização e prevenção na comunidade',
        'Garantir a confidencialidade e o respeito pela dignidade dos utentes',
      ]},
    // Farmácia
    { rx: /farmac/,
      items: [
        'Aviar receitas médicas, verificando dosagem, posologia e validade',
        'Prestar aconselhamento farmacêutico a clientes sobre medicamentos e produtos de saúde',
        'Controlar o stock de medicamentos e produtos, fazendo encomendas quando necessário',
        'Garantir a correcta armazenagem dos medicamentos (temperatura, humidade, validades)',
        'Verificar a conformidade das facturas de fornecedores com as encomendas recebidas',
        'Registar entradas e saídas de estupefacientes e psicotrópicos conforme legislação',
        'Manter a farmácia organizada e cumprir as normas de higiene e segurança',
      ]},
  ];
  const match = maps.find(m => m.rx.test(jt));
  const items = match ? match.items : [
    `Desenvolver as actividades específicas do cargo de ${jobTitle} com rigor e profissionalismo`,
    'Planear e executar tarefas diárias de acordo com as prioridades definidas pela chefia',
    'Garantir o cumprimento dos prazos e a qualidade dos resultados entregues',
    'Identificar problemas operacionais e propor soluções práticas e eficientes',
    'Comunicar de forma clara e proactiva com a equipa e superiores hierárquicos',
    'Manter registos actualizados e organizar a documentação inerente ao cargo',
    'Contribuir para a melhoria contínua dos processos e do desempenho da equipa',
  ];
  return items.map(i => `• ${i}`).join('\n');
}

module.exports = router;
