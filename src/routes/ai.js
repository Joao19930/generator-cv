const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

const TEMPLATES_FILE = path.join(__dirname, '../data/jobTemplates.json');

// Cache em memória — populado na 1ª chamada à BD
let _tplCache = null;

async function refreshTemplatesCache(db) {
  try {
    const r = await db.request()
      .query(`SELECT value FROM app_settings WHERE key = 'job_templates'`);
    if (r.recordset.length > 0) {
      _tplCache = JSON.parse(r.recordset[0].value);
      return;
    }
  } catch {}
  // fallback: ficheiro local
  try { _tplCache = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8')); } catch {}
}

function loadTemplates() {
  if (_tplCache) return _tplCache;
  try { return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8')); } catch { return null; }
}

let _client;
const getClient = () => {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
};

// POST /api/ai/stream — streaming proxy para Anthropic
router.post('/stream', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const stream = await getClient().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: system || '',
      messages: messages.slice(-10),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// POST /api/ai — chamada simples (não-streaming) para o editor React
router.post('/', async (req, res) => {
  const { prompt, max_tokens = 800 } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  // Garantir templates carregados da BD
  if (!_tplCache && req.db) await refreshTemplatesCache(req.db);

  // Templates do admin têm prioridade sobre a IA
  const tplText = localFallback(prompt);
  if (tplText) return res.json({ text: tplText });

  // Sem template configurado → gerar com Anthropic
  try {
    const msg = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    res.status(503).json({ error: 'Serviço IA indisponível. Adiciona créditos em console.anthropic.com.' });
  }
});

// Normaliza género: remove sufixo '-a' de formas femininas em '-ora'/'-ora'
// para que "gestora" bata em keyword "gestor" e vice-versa.
function normGender(text) {
  return text.toLowerCase().replace(/\b(\w+or)a\b/g, '$1');
}

// Verifica se o cargo contém o keyword, com normalização de género.
function matchesKeyword(cargo, kw) {
  const c = cargo.toLowerCase();
  const k = kw.toLowerCase();
  if (c.includes(k)) return true;
  // normalizar -ora → -or em ambos os lados
  return normGender(c).includes(normGender(k));
}

// Devolve a área personalizada do admin que melhor corresponde ao cargo.
// "Melhor" = keyword mais longo que fizer match (maior especificidade).
function bestCustomArea(cargo, customAreas) {
  let best = null;
  let bestLen = 0;
  for (const area of (customAreas || [])) {
    for (const kw of (area.keywords || [])) {
      if (matchesKeyword(cargo, kw) && kw.length > bestLen) {
        bestLen = kw.length;
        best = area;
      }
    }
  }
  return best;
}

// Fallback local para quando não há créditos Anthropic
function localFallback(prompt) {
  const p = prompt.toLowerCase();

  // Caso 1: gerar resumo profissional
  if (p.includes('resumo profissional') || p.includes('escreve um resumo')) {
    const cargoMatch = prompt.match(/Cargo[:\s]+([^,.\n]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : 'Profissional';
    const anosMatch = prompt.match(/Anos de experiência[:\s]+(\d+)/i);
    const anos = anosMatch ? parseInt(anosMatch[1]) : 0;
    const skillsMatch = prompt.match(/Competências[:\s]+([^\n]+)/i);
    const skills = skillsMatch ? skillsMatch[1].trim() : '';
    const expMatch = prompt.match(/Experiências[:\s]+([^\n]+)/i);
    const expRaw = expMatch ? expMatch[1].trim() : '';

    const anosStr = anos > 0 ? `${anos} anos de experiência` : 'vasta experiência';
    const c = cargo.toLowerCase();

    const empresaMatch = expRaw.match(/na ([^;(]+)/i);
    const empresa = empresaMatch ? empresaMatch[1].trim() : '';
    const ctxEmpresa = empresa && empresa !== 'não especificado' ? ` em organizações como ${empresa}` : ' no mercado angolano';

    const skillArr = skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const skillsFrase = skillArr.length >= 2
      ? `Domina ${skillArr.join(', ')}`
      : 'Possui competências técnicas sólidas na área';

    const tpl = loadTemplates();
    const sumTpl = tpl && tpl.summary;
    function applySumTpl(key) {
      if (!sumTpl || !sumTpl[key]) return null;
      return sumTpl[key]
        .replace('{cargo}', cargo)
        .replace('{anos}', anosStr)
        .replace(/\{ctx\}/g, ctxEmpresa)
        .replace('{skills}', skillsFrase);
    }

    // Áreas personalizadas do admin têm prioridade — keyword mais específico ganha
    const customMatch = bestCustomArea(c, tpl && tpl._customAreas);
    if (customMatch) {
      const result = applySumTpl(customMatch.key);
      // Área custom encontrada mas sem resumo → saltar fixas para não usar conteúdo errado
      return result || applySumTpl('default') || `${cargo} com ${anosStr}${ctxEmpresa}, com historial consistente na entrega de resultados em ambientes exigentes. ${skillsFrase}. Reconhecido(a) pela capacidade analítica e resolução eficaz de problemas, com contribuição para a melhoria contínua dos processos organizacionais. Procura um desafio profissional onde possa aplicar a sua experiência e gerar impacto real em Angola.`;
    }

    // Áreas fixas (fallback)
    if (/rh|recursos humanos|people|talento/.test(c)) {
      return applySumTpl('rh') || `Gestor(a) de Recursos Humanos com ${anosStr}${ctxEmpresa}, especializado(a) em recrutamento, avaliação de desempenho e relações laborais. ${skillsFrase}, com profundo conhecimento da legislação laboral angolana. Liderou processos de gestão de talento que fortaleceram a cultura organizacional. Procura contribuir para organizações que valorizam o capital humano como vantagem competitiva.`;
    }
    if (/comercial|vendas|sales|negócios|negoc/.test(c)) {
      return applySumTpl('comercial') || `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em desenvolvimento de negócio e fidelização de clientes B2B e B2C. ${skillsFrase}. Historial consistente de cumprimento e superação de metas comerciais, com foco em negociação e identificação de oportunidades no mercado angolano. Tem como objectivo integrar uma equipa comercial de referência e continuar a gerar impacto mensurável.`;
    }
    if (/financ|contab|audit|tesour/.test(c)) {
      return applySumTpl('financeiro') || `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em contabilidade geral, reporte financeiro e conformidade fiscal. ${skillsFrase}. Sólido conhecimento das obrigações perante a AGT e INSS, com experiência na melhoria de controlos internos e fiabilidade dos relatórios mensais. Procura contribuir para a solidez financeira de organizações em crescimento em Angola.`;
    }
    if (/inform|ti\b|software|programa|system|develop|dados/.test(c)) {
      return applySumTpl('ti') || `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em desenvolvimento de sistemas e transformação digital. ${skillsFrase}. Experiência em gestão de projectos tecnológicos e entrega de soluções que melhoram a performance operacional. Pretende aplicar competências técnicas em organizações angolanas em processo de modernização.`;
    }
    if (/gest|direct|manager|lider|coord/.test(c)) {
      return applySumTpl('gestao') || `${cargo} com ${anosStr}${ctxEmpresa}, com experiência comprovada em liderança de equipas e gestão por objectivos. ${skillsFrase}. Foco em optimização de processos e desenvolvimento de talento interno, com resultados consistentes na melhoria da eficiência organizacional. Pretende liderar projectos de crescimento em organizações com visão estratégica em Angola.`;
    }
    if (/market|comunic|digital|publicid/.test(c)) {
      return applySumTpl('marketing') || `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em marketing digital, gestão de marca e comunicação estratégica. ${skillsFrase}. Combina criatividade com análise de dados para maximizar o retorno das acções de marketing. Procura aplicar esta visão em marcas angolanas com ambição de crescimento acelerado.`;
    }

    return applySumTpl('default') || `${cargo} com ${anosStr}${ctxEmpresa}, com historial consistente na entrega de resultados em ambientes exigentes. ${skillsFrase}. Reconhecido(a) pela capacidade analítica e resolução eficaz de problemas, com contribuição para a melhoria contínua dos processos organizacionais. Procura um desafio profissional onde possa aplicar a sua experiência e gerar impacto real em Angola.`;
  }

  // Caso 2: melhorar bullet isolado (prompt curto, contém "melhora este" ou "verbo de acção")
  if (p.includes('melhora este') || p.includes('verbo de ac')) {
    const textMatch = prompt.match(/texto[:\s]+([^\n]+)/i) || prompt.match(/"([^"]+)"/);
    if (textMatch) {
      const t = textMatch[1].trim();
      return `Implementei e optimizei ${t.charAt(0).toLowerCase() + t.slice(1)}, contribuindo directamente para a melhoria dos resultados da organização.`;
    }
  }

  // Caso 3: sugerir competências
  if (p.includes('compet') || p.includes('lista') || p.includes('skills')) {
    const cargoMatch = prompt.match(/profissional de ([^\n,]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim().toLowerCase() : '';
    if (/inform|software|programa|ti\b|it\b/.test(cargo))
      return 'JavaScript, Python, SQL, Git, React, Node.js, Docker, APIs REST';
    if (/market|comunica|digital/.test(cargo))
      return 'Google Analytics, SEO, Redes Sociais, Copywriting, Canva, Email Marketing';
    if (/gest|director|manager|lider/.test(cargo))
      return 'Liderança de Equipas, Gestão de Projectos, KPIs, Orçamentação, Excel Avançado';
    if (/contabil|financ|audit/.test(cargo))
      return 'Excel Avançado, SAP, Reconciliação Bancária, Relatórios Financeiros, IRT, INSS';
    return 'Microsoft Office, Comunicação Escrita, Trabalho em Equipa, Gestão do Tempo, Resolução de Problemas';
  }

  // Caso 4: descrição de experiência (ExperienceSection do editor React)
  // Detectar pelo par Cargo+Empresa que é exclusivo deste prompt
  if (p.includes('cargo:') && p.includes('empresa:')) {
    const cargoMatch = prompt.match(/Cargo[:\s]+([^\n]+)/i);
    const empresaMatch = prompt.match(/Empresa[:\s]+([^\n]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : 'Profissional';
    const empresa = empresaMatch ? empresaMatch[1].trim() : '';
    const temEmpresa = empresa && empresa !== 'não especificada';
    const ctx = temEmpresa ? ` na ${empresa}` : '';
    const c = cargo.toLowerCase();

    const tpl = loadTemplates();
    const expTpl = tpl && tpl.experience;

    function applyExpTpl(key) {
      if (!expTpl || !expTpl[key]) return null;
      return expTpl[key]
        .map(b => b.replace(/\{ctx\}/g, ctx).replace('{cargo}', cargo))
        .join('\n');
    }

    // Áreas personalizadas do admin têm prioridade — keyword mais específico ganha
    const customMatch = bestCustomArea(c, tpl && tpl._customAreas);
    if (customMatch) {
      const result = applyExpTpl(customMatch.key);
      // Área custom encontrada mas sem bullets → saltar fixas para não usar conteúdo errado
      return result || applyExpTpl('default') ||
        `Desempenhou as funções de ${cargo}${ctx} com elevado sentido de responsabilidade e orientação para resultados\nOptimizou processos internos, contribuindo para a melhoria da eficiência operacional\nColaborou activamente com as diferentes áreas, assegurando o cumprimento de prazos e objectivos\nElaborou relatórios de actividade e propôs melhorias implementadas com sucesso`;
    }

    // Áreas fixas (fallback)
    if (/rh|recursos humanos|people|talento/.test(c)) {
      return applyExpTpl('rh') ||
        `Liderou processos de recrutamento e selecção de quadros${ctx}, assegurando contratações alinhadas com a cultura organizacional\nImplementou políticas de avaliação de desempenho e planos de desenvolvimento individual\nGeriu relações laborais e assegurou conformidade com a legislação angolana do trabalho\nCoordenou formações internas e programas de integração para novos colaboradores`;
    }
    if (/comercial|vendas|sales|negócios|negoc/.test(c)) {
      return applyExpTpl('comercial') ||
        `Geriu carteira de clientes${ctx}, cumprindo e superando as metas comerciais definidas pela direcção\nNegociou contratos e parcerias estratégicas com empresas e instituições em Angola\nIdentificou oportunidades de mercado e desenvolveu propostas comerciais competitivas\nElaborou relatórios de desempenho comercial e apresentou resultados à direcção`;
    }
    if (/financ|contab|audit|tesour/.test(c)) {
      return applyExpTpl('financeiro') ||
        `Supervisionou a contabilidade geral e preparação de demonstrações financeiras${ctx}\nGarantiu conformidade fiscal e cumprimento das obrigações com AGT e INSS\nElaborou orçamentos, previsões de cash-flow e análises de desvios mensais\nCoordenou auditorias internas e implementou melhorias nos controlos financeiros`;
    }
    if (/inform|ti\b|software|programa|system|develop|dados/.test(c)) {
      return applyExpTpl('ti') ||
        `Desenvolveu e manteve sistemas e aplicações${ctx} utilizando tecnologias adequadas às necessidades do negócio\nImplementou melhorias técnicas que aumentaram a estabilidade e performance dos sistemas\nColaborou com equipas multidisciplinares em projectos de transformação digital\nDocumentou processos e assegurou a segurança e integridade dos dados organizacionais`;
    }
    if (/gest|direct|manager|lider|coord/.test(c)) {
      return applyExpTpl('gestao') ||
        `Liderou equipa de colaboradores${ctx}, promovendo cultura de responsabilidade e orientação para resultados\nDefiniu objectivos estratégicos e acompanhou indicadores de desempenho mensais\nOptimizou processos operacionais, garantindo qualidade e eficiência no cumprimento dos prazos\nReportou à administração e propôs planos de melhoria contínua baseados em dados`;
    }
    if (/market|comunic|digital|publicid/.test(c)) {
      return applyExpTpl('marketing') ||
        `Planeou e executou campanhas de marketing digital e tradicional${ctx}\nGeriu redes sociais e conteúdos, aumentando o alcance e a notoriedade da marca\nAnalisou métricas de desempenho e ajustou estratégias para maximizar o retorno\nCoordenou produção de materiais de comunicação e identidade visual da organização`;
    }

    return applyExpTpl('default') ||
      `Desempenhou as funções de ${cargo}${ctx} com elevado sentido de responsabilidade e orientação para resultados\nOptimizou processos internos, contribuindo para a melhoria da eficiência operacional\nColaborou activamente com as diferentes áreas, assegurando o cumprimento de prazos e objectivos\nElaborou relatórios de actividade e propôs melhorias implementadas com sucesso`;
  }

  // Fallback genérico — nunca retornar null para prompts longos
  if (p.length > 100) {
    return 'Profissional com sólida experiência na área, orientado(a) para resultados e com capacidade de adaptação a diferentes contextos organizacionais. Destaca-se pelo rigor técnico, proactividade e compromisso com a entrega de valor.';
  }

  return null;
}

module.exports = router;
module.exports._invalidateCache = () => { _tplCache = null; };
